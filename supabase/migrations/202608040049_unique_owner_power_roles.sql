begin;

-- A declared Unique Player is power-restricted only when borrowed. The owning
-- member may still use Captain, Vice-Captain, BAI/BOI and 3X on that player.
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
    select count(*) into v_usage_count
    from public.lineup_players lineup_player
    join public.lineup_submissions lineup on lineup.id = lineup_player.lineup_id
    join public.fixtures used_fixture on used_fixture.id = lineup.fixture_id
    where lineup.league_id = v_fixture.league_id
      and lineup_player.player_id = p_player_id
      and used_fixture.match_number < v_fixture.match_number
      and (used_fixture.status in ('live', 'completed', 'abandoned') or now() >= used_fixture.lineup_lock_at)
      and lineup.status in ('submitted', 'locked');
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
