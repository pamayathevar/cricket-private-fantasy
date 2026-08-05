-- Make each member's first submitted lineup transfer-free and charge only fresh external players thereafter.
begin;

-- IPL 2026 default: 105 across Matches 2-70 and 4 across Matches 72-74.
-- Match 1 and the first playoff fixture are free starting XIs.
update public.leagues
set playoff_transfer_limit = 4, updated_at = now()
where id = '10000000-0000-4000-8000-000000002026'
  and playoff_transfer_limit = 6;

create or replace function public.update_league_transfer_limits(
  p_league_id uuid,
  p_league_stage_limit integer,
  p_playoff_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_admin(p_league_id) then raise exception 'League admin access required'; end if;
  if p_league_stage_limit < 0 or p_playoff_limit < 0 then raise exception 'Transfer limits cannot be negative'; end if;
  update public.leagues set league_stage_transfer_limit = p_league_stage_limit,
    playoff_transfer_limit = p_playoff_limit, updated_at = now()
  where id = p_league_id;
  if not found then raise exception 'League not found'; end if;
  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (p_league_id, auth.uid(), 'transfer_limits_updated', 'league', p_league_id::text,
    jsonb_build_object('league_stage_limit', p_league_stage_limit, 'playoff_limit', p_playoff_limit,
      'first_league_lineup_free', true, 'first_playoff_lineup_free', true));
  return jsonb_build_object('league_stage_limit', p_league_stage_limit, 'playoff_limit', p_playoff_limit);
end;
$$;

revoke all on function public.update_league_transfer_limits(uuid, integer, integer) from public;
grant execute on function public.update_league_transfer_limits(uuid, integer, integer) to authenticated;

create or replace function public.submit_lineup_with_transfer_enforcement(
  p_fixture_id uuid,
  p_player_ids uuid[],
  p_captain_player_id uuid default null,
  p_vice_captain_player_id uuid default null,
  p_impact_player_id uuid default null,
  p_impact_type text default null,
  p_booster_code text default null,
  p_booster_player_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_league public.leagues%rowtype;
  v_member_id uuid;
  v_previous_lineup_id uuid;
  v_lineup_id uuid;
  v_stage text;
  v_limit integer;
  v_used integer;
  v_new_transfers integer := 0;
  v_initial_lineup boolean;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  select * into v_league from public.leagues where id = v_fixture.league_id;
  v_member_id := public.current_member_id(v_fixture.league_id);
  if v_member_id is null then raise exception 'Active league membership required'; end if;

  v_stage := case when v_fixture.stage in ('playoff', 'final') then 'playoff' else 'league' end;
  v_limit := case when v_stage = 'league' then v_league.league_stage_transfer_limit else v_league.playoff_transfer_limit end;

  select lineup.id into v_previous_lineup_id
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.member_id = v_member_id
    and lineup.league_id = v_fixture.league_id
    and lineup.status in ('submitted', 'locked')
    and fixture.match_number < v_fixture.match_number
    and (case when fixture.stage in ('playoff', 'final') then 'playoff' else 'league' end) = v_stage
  order by fixture.match_number desc
  limit 1;
  v_initial_lineup := v_previous_lineup_id is null;

  if not v_initial_lineup then
    select count(*) into v_new_transfers
    from unnest(p_player_ids) selected(player_id)
    join public.league_players league_player
      on league_player.league_id = v_fixture.league_id
     and league_player.player_id = selected.player_id
     and league_player.active
    where league_player.owner_member_id is distinct from v_member_id
      and not exists (
        select 1 from public.lineup_players previous
        where previous.lineup_id = v_previous_lineup_id
          and previous.player_id = selected.player_id
      );
  end if;

  select coalesce(sum(transfer_count), 0) into v_used
  from public.transfer_events
  where league_id = v_fixture.league_id
    and member_id = v_member_id
    and stage = v_stage
    and reason = 'lineup_change'
    and fixture_id is distinct from p_fixture_id;

  if coalesce(p_booster_code, '') <> 'SUP-TR' and v_used + v_new_transfers > v_limit then
    raise exception '% transfer limit exceeded: % used + % new, limit %. Select owned or carried players, or use SUP-TR.',
      case when v_stage = 'league' then 'League-stage' else 'Playoff' end,
      v_used, v_new_transfers, v_limit;
  end if;

  v_lineup_id := public.submit_lineup_with_booster(
    p_fixture_id, p_player_ids, p_captain_player_id, p_vice_captain_player_id,
    p_impact_player_id, p_impact_type, p_booster_code, p_booster_player_id
  );

  delete from public.transfer_events
  where league_id = v_fixture.league_id
    and member_id = v_member_id
    and fixture_id = p_fixture_id
    and reason = 'lineup_change';

  if not v_initial_lineup and coalesce(p_booster_code, '') <> 'SUP-TR' then
    insert into public.transfer_events (
      league_id, member_id, fixture_id, player_in_id, stage,
      transfer_count, reason, created_by
    )
    select v_fixture.league_id, v_member_id, p_fixture_id, selected.player_id,
      v_stage, 1, 'lineup_change', auth.uid()
    from unnest(p_player_ids) selected(player_id)
    join public.league_players league_player
      on league_player.league_id = v_fixture.league_id
     and league_player.player_id = selected.player_id
     and league_player.active
    where league_player.owner_member_id is distinct from v_member_id
      and not exists (
        select 1 from public.lineup_players previous
        where previous.lineup_id = v_previous_lineup_id
          and previous.player_id = selected.player_id
      );
  end if;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (
    v_fixture.league_id, auth.uid(), 'lineup_transfers_recorded', 'lineup_submission', v_lineup_id::text,
    jsonb_build_object('fixture_id', p_fixture_id, 'stage', v_stage,
      'initial_lineup_free', v_initial_lineup,
      'charged_transfers', case when p_booster_code = 'SUP-TR' then 0 else v_new_transfers end,
      'used_before', v_used, 'balance_after', v_limit - v_used - case when p_booster_code = 'SUP-TR' then 0 else v_new_transfers end)
  );
  return v_lineup_id;
end;
$$;

revoke all on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) to authenticated;

-- Backfill missing transfer events for existing lineups. The first lineup is free.
with ordered_lineups as (
  select lineup.id, lineup.league_id, lineup.member_id, lineup.fixture_id,
    fixture.stage, fixture.match_number,
    lag(lineup.id) over (
      partition by lineup.league_id, lineup.member_id,
        case when fixture.stage in ('playoff', 'final') then 'playoff' else 'league' end
      order by fixture.match_number
    ) previous_lineup_id
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.status in ('submitted', 'locked')
), chargeable as (
  select ordered.*, lineup_player.player_id,
    member.user_id created_by,
    case when ordered.stage in ('playoff', 'final') then 'playoff' else 'league' end transfer_stage
  from ordered_lineups ordered
  join public.lineup_players lineup_player on lineup_player.lineup_id = ordered.id
  join public.league_players league_player on league_player.league_id = ordered.league_id
    and league_player.player_id = lineup_player.player_id and league_player.active
  join public.league_members member on member.id = ordered.member_id
  left join public.lineup_boosters lineup_booster on lineup_booster.lineup_id = ordered.id
  left join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
  where ordered.previous_lineup_id is not null
    and league_player.owner_member_id is distinct from ordered.member_id
    and coalesce(booster.code, '') <> 'SUP-TR'
    and not exists (
      select 1 from public.lineup_players previous
      where previous.lineup_id = ordered.previous_lineup_id
        and previous.player_id = lineup_player.player_id
    )
)
insert into public.transfer_events (
  league_id, member_id, fixture_id, player_in_id, stage,
  transfer_count, reason, created_by
)
select chargeable.league_id, chargeable.member_id, chargeable.fixture_id,
  chargeable.player_id, chargeable.transfer_stage, 1, 'lineup_change', chargeable.created_by
from chargeable
where not exists (
  select 1 from public.transfer_events event
  where event.league_id = chargeable.league_id
    and event.member_id = chargeable.member_id
    and event.fixture_id = chargeable.fixture_id
    and event.player_in_id = chargeable.player_id
    and event.reason = 'lineup_change'
);

commit;
