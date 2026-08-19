-- Materialize an eligible owner's carried XI when a specific fixture reaches
-- its lock. This is insert-only: real submissions and drafts are never
-- overwritten, and transfers or boosters are never copied or deleted.
begin;

create or replace function public.materialize_locked_fixture_lineups(
  p_fixture_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_rules public.lineup_rule_sets%rowtype;
  v_member public.league_members%rowtype;
  v_source public.lineup_submissions%rowtype;
  v_lineup_id uuid;
  v_player_count integer;
  v_batters integer;
  v_bowlers integer;
  v_wicketkeepers integer;
  v_all_rounders integer;
  v_max_from_team integer;
  v_lineup_cost numeric(10,2);
  v_borrowed_count integer;
  v_captain_player_id uuid;
  v_vice_captain_player_id uuid;
  v_impact_player_id uuid;
  v_impact_type text;
  v_created integer := 0;
  v_existing integer := 0;
  v_skipped_no_source integer := 0;
  v_skipped_invalid integer := 0;
begin
  select * into v_fixture
  from public.fixtures
  where id = p_fixture_id
  for update;

  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_member(v_fixture.league_id) then
    raise exception 'Active league membership required';
  end if;
  if now() < v_fixture.lineup_lock_at then
    raise exception 'Fixture has not reached its lineup lock';
  end if;
  if v_fixture.status not in ('scheduled', 'live', 'completed')
     or v_fixture.scoring_status in ('published', 'corrected') then
    return jsonb_build_object('created', 0, 'existing', 0, 'fixture_ineligible', true);
  end if;

  select * into v_rules
  from public.lineup_rule_sets
  where id = public.lineup_rule_set_for_fixture(v_fixture.id);

  if v_rules.id is null or not v_rules.carry_forward_enabled then
    return jsonb_build_object('created', 0, 'existing', 0, 'carry_forward_disabled', true);
  end if;

  for v_member in
    select member.*
    from public.league_members member
    where member.league_id = v_fixture.league_id
      and member.status = 'active'
      and member.role in ('league_admin', 'owner')
    order by member.id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_fixture.league_id::text || ':' || v_member.id::text, 0)
    );

    if exists (
      select 1 from public.lineup_submissions
      where fixture_id = v_fixture.id and member_id = v_member.id
    ) then
      v_existing := v_existing + 1;
      continue;
    end if;

    select lineup.* into v_source
    from public.lineup_submissions lineup
    join public.fixtures source_fixture on source_fixture.id = lineup.fixture_id
    where lineup.league_id = v_fixture.league_id
      and lineup.member_id = v_member.id
      and source_fixture.match_number < v_fixture.match_number
      and source_fixture.status not in ('abandoned', 'cancelled')
      and lineup.status in ('submitted', 'locked')
      and lineup.validation_status = 'valid'
    order by source_fixture.match_number desc, lineup.submitted_at desc
    limit 1;

    if not found then
      v_skipped_no_source := v_skipped_no_source + 1;
      continue;
    end if;

    select
      count(*)::integer,
      count(*) filter (where player.role = 'BA')::integer,
      count(*) filter (where player.role = 'BO')::integer,
      count(*) filter (where player.role = 'WK')::integer,
      count(*) filter (where player.role = 'AL')::integer,
      coalesce(sum(league_player.acquisition_price), 0)::numeric(10,2),
      count(*) filter (
        where league_player.owner_member_id is distinct from v_member.id
      )::integer
    into
      v_player_count, v_batters, v_bowlers, v_wicketkeepers,
      v_all_rounders, v_lineup_cost, v_borrowed_count
    from public.lineup_players source_player
    join public.players player
      on player.id = source_player.player_id and player.active
    join public.league_players league_player
      on league_player.league_id = v_fixture.league_id
     and league_player.player_id = source_player.player_id
     and league_player.active
    where source_player.lineup_id = v_source.id;

    select coalesce(max(team_count), 0)::integer into v_max_from_team
    from (
      select count(*) team_count
      from public.lineup_players source_player
      join public.players player on player.id = source_player.player_id
      where source_player.lineup_id = v_source.id
      group by player.team_id
    ) grouped_teams;

    if v_player_count <> v_rules.lineup_size
       or v_batters < v_rules.min_batters
       or v_bowlers < v_rules.min_bowlers
       or v_wicketkeepers < v_rules.min_wicketkeepers
       or v_all_rounders < v_rules.min_all_rounders
       or v_max_from_team > v_rules.max_from_one_team
       or v_lineup_cost > v_rules.lineup_budget then
      v_skipped_invalid := v_skipped_invalid + 1;
      continue;
    end if;

    v_captain_player_id := v_source.captain_player_id;
    v_vice_captain_player_id := v_source.vice_captain_player_id;
    v_impact_player_id := v_source.impact_player_id;
    v_impact_type := v_source.impact_type;

    if v_captain_player_id is not null and public.player_power_restriction_reason(
      v_fixture.id, v_member.id, v_captain_player_id, 'captain'
    ) is not null then
      v_captain_player_id := null;
    end if;
    if v_vice_captain_player_id is not null and public.player_power_restriction_reason(
      v_fixture.id, v_member.id, v_vice_captain_player_id, 'vice_captain'
    ) is not null then
      v_vice_captain_player_id := null;
    end if;
    if v_impact_player_id is not null and (
      not v_rules.impact_enabled
      or (v_impact_type = 'BAI' and not v_rules.impact_batting_enabled)
      or (v_impact_type = 'BOI' and not v_rules.impact_bowling_enabled)
      or public.player_power_restriction_reason(
        v_fixture.id, v_member.id, v_impact_player_id, 'impact'
      ) is not null
    ) then
      v_impact_player_id := null;
      v_impact_type := null;
    end if;

    v_lineup_id := null;
    insert into public.lineup_submissions (
      league_id, fixture_id, member_id, status,
      captain_player_id, vice_captain_player_id,
      impact_player_id, impact_type, lineup_cost,
      borrowed_player_count, submitted_at, locked_at,
      validation_status, validation_errors, validated_rule_set_id
    ) values (
      v_fixture.league_id, v_fixture.id, v_member.id, 'locked',
      v_captain_player_id, v_vice_captain_player_id,
      v_impact_player_id, v_impact_type, v_lineup_cost,
      v_borrowed_count, v_fixture.lineup_lock_at, v_fixture.lineup_lock_at,
      'valid', '[]'::jsonb, v_rules.id
    ) on conflict (fixture_id, member_id) do nothing
    returning id into v_lineup_id;

    if v_lineup_id is null then
      v_existing := v_existing + 1;
      continue;
    end if;

    insert into public.lineup_players (lineup_id, player_id, slot, is_borrowed)
    select
      v_lineup_id,
      source_player.player_id,
      source_player.slot,
      league_player.owner_member_id is distinct from v_member.id
    from public.lineup_players source_player
    join public.league_players league_player
      on league_player.league_id = v_fixture.league_id
     and league_player.player_id = source_player.player_id
     and league_player.active
    where source_player.lineup_id = v_source.id
    order by source_player.slot;

    -- No booster and no transfer event are inserted: every fixture starts
    -- without a booster and an unchanged carried XI costs zero transfers.
    v_created := v_created + 1;
  end loop;

  if v_created > 0 then
    insert into public.audit_events (
      league_id, actor_user_id, action, entity_type, entity_id, after_data
    ) values (
      v_fixture.league_id, auth.uid(), 'locked_lineups_materialized', 'fixture',
      v_fixture.id::text,
      jsonb_build_object(
        'match_number', v_fixture.match_number,
        'created_from_carry_forward', v_created,
        'existing_lineups', v_existing,
        'skipped_no_source', v_skipped_no_source,
        'skipped_invalid_source', v_skipped_invalid
      )
    );
  end if;

  return jsonb_build_object(
    'created_from_carry_forward', v_created,
    'existing_lineups', v_existing,
    'skipped_no_source', v_skipped_no_source,
    'skipped_invalid_source', v_skipped_invalid
  );
end;
$$;

revoke all on function public.materialize_locked_fixture_lineups(uuid)
  from public, anon;
grant execute on function public.materialize_locked_fixture_lineups(uuid)
  to authenticated;

-- Publishing is the final safety boundary. Even if nobody has opened Results,
-- carried XIs must exist before score completeness is checked.
do $$
declare
  v_signature regprocedure := 'public.publish_match_scores_safe(uuid)'::regprocedure;
  v_definition text;
  v_anchor text := 'if not public.is_league_admin(v_fixture.league_id) then raise exception ''League admin access required''; end if;';
  v_replacement text := v_anchor || E'\n  perform public.materialize_locked_fixture_lineups(p_fixture_id);';
begin
  select pg_get_functiondef(v_signature) into v_definition;
  if position('materialize_locked_fixture_lineups' in v_definition) = 0 then
    if position(v_anchor in v_definition) = 0 then
      raise exception 'publish_match_scores_safe authorization boundary was not recognized';
    end if;
    execute replace(v_definition, v_anchor, v_replacement);
  end if;
end;
$$;

commit;
