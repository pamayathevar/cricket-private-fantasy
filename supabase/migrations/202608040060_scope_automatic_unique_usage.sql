begin;

-- Automatic Unique is driven by meaningful borrowing demand for a player:
-- only another owner's locked use, in a fixture involving that player's IPL
-- team, contributes to the threshold. The owning member's own XI and fixtures
-- between other IPL teams do not contribute.
create or replace function public.automatic_unique_qualifying_usage_count(
  p_fixture_id uuid,
  p_player_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.fixtures target_fixture
  join public.league_players league_player
    on league_player.league_id = target_fixture.league_id
   and league_player.player_id = p_player_id
   and league_player.active
   and league_player.owner_member_id is not null
  join public.players player
    on player.id = league_player.player_id
  join public.lineup_submissions lineup
    on lineup.league_id = target_fixture.league_id
   and lineup.member_id <> league_player.owner_member_id
   and lineup.status in ('submitted', 'locked')
  join public.fixtures used_fixture
    on used_fixture.id = lineup.fixture_id
   and used_fixture.match_number < target_fixture.match_number
   and used_fixture.status not in ('abandoned', 'cancelled')
   and (
     used_fixture.status in ('live', 'completed')
     or now() >= used_fixture.lineup_lock_at
   )
   and player.team_id in (used_fixture.home_team_id, used_fixture.away_team_id)
  join public.lineup_players lineup_player
    on lineup_player.lineup_id = lineup.id
   and lineup_player.player_id = league_player.player_id
   and lineup_player.is_borrowed
  where target_fixture.id = p_fixture_id;
$$;

revoke all on function public.automatic_unique_qualifying_usage_count(uuid, uuid) from public;

create or replace function public.special_player_labels_for_fixture(p_fixture_id uuid)
returns table(player_id uuid, full_name text, label text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_rules public.special_player_rule_sets%rowtype;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;
  if auth.uid() is not null and not public.is_league_member(v_fixture.league_id) then
    raise exception 'Active league membership required';
  end if;

  select * into v_rules
  from public.special_player_rules_for_match(v_fixture.league_id, v_fixture.match_number);
  if v_rules.id is null then return; end if;

  if v_rules.unique_mode_enabled then
    return query
      select player.id, player.full_name, 'UNIQUE'::text
      from public.effective_phase_special_players(v_fixture.phase_id, 'unique') selected
      join public.players player on player.id = selected.player_id;
  elsif v_rules.marquee_mode_enabled then
    return query
      select player.id, player.full_name, 'MARQUEE'::text
      from public.effective_phase_special_players(v_fixture.phase_id, 'marquee') selected
      join public.players player on player.id = selected.player_id;

    if v_rules.automatic_unique_enabled then
      return query
        select player.id, player.full_name, 'AUTO UNIQUE'::text
        from public.league_players league_player
        join public.players player on player.id = league_player.player_id
        where league_player.league_id = v_fixture.league_id
          and league_player.active
          and league_player.owner_member_id is not null
          and public.automatic_unique_qualifying_usage_count(
            p_fixture_id,
            league_player.player_id
          ) > v_rules.automatic_unique_usage_threshold;
    end if;
  end if;
end;
$$;

revoke all on function public.special_player_labels_for_fixture(uuid) from public;
grant execute on function public.special_player_labels_for_fixture(uuid) to authenticated;

create or replace function public.player_power_restriction_reason(
  p_fixture_id uuid, p_member_id uuid, p_player_id uuid, p_marker text
)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_rules public.special_player_rule_sets%rowtype;
  v_owner_member_id uuid;
  v_usage_count integer;
  v_marker_restricted boolean;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id;
  if not found then return null; end if;
  select * into v_rules from public.special_player_rules_for_match(v_fixture.league_id, v_fixture.match_number);
  if v_rules.id is null then return null; end if;

  if p_marker not in ('captain', 'vice_captain', 'impact', '3x') then
    raise exception 'Unknown power-player marker';
  end if;
  v_marker_restricted := case p_marker
    when 'captain' then v_rules.unique_restrict_captain
    when 'vice_captain' then v_rules.unique_restrict_vice_captain
    when 'impact' then v_rules.unique_restrict_impact
    when '3x' then v_rules.unique_restrict_3x
    else false
  end;

  select owner_member_id into v_owner_member_id
  from public.league_players
  where league_id = v_fixture.league_id and player_id = p_player_id and active;

  if v_rules.unique_mode_enabled
    and v_marker_restricted
    and v_owner_member_id is not null
    and v_owner_member_id <> p_member_id
    and exists (
      select 1
      from public.effective_phase_special_players(v_fixture.phase_id, 'unique') selected
      where selected.player_id = p_player_id
    )
  then
    return 'Another owner''s Phase Unique Player cannot be used as a power player';
  end if;

  if v_rules.marquee_mode_enabled
    and v_rules.automatic_unique_enabled
    and v_owner_member_id is not null
    and v_owner_member_id <> p_member_id
  then
    v_usage_count := public.automatic_unique_qualifying_usage_count(
      p_fixture_id,
      p_player_id
    );
    if v_usage_count > v_rules.automatic_unique_usage_threshold and v_marker_restricted then
      return 'Automatically Unique Player cannot be used as a power player by another owner';
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.player_power_restriction_reason(uuid, uuid, uuid, text) from public;
grant execute on function public.player_power_restriction_reason(uuid, uuid, uuid, text) to authenticated;

commit;
