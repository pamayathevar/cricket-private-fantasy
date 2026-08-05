-- Transactional, versioned rule publishing for the League Admin screen.
begin;

create or replace function public.publish_league_rules(
  p_league_id uuid,
  p_lineup_rules jsonb,
  p_scoring_rules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.lineup_rule_sets%rowtype;
  v_lineup_version integer;
  v_scoring_version integer;
  v_lineup_size integer := (p_lineup_rules ->> 'lineup_size')::integer;
  v_minimum_roles integer;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'League admin access required';
  end if;
  if jsonb_typeof(p_lineup_rules) is distinct from 'object' or jsonb_typeof(p_scoring_rules) is distinct from 'object' then
    raise exception 'Playing and scoring rules must be JSON objects';
  end if;

  select * into v_current
  from public.lineup_rule_sets
  where league_id = p_league_id and active
  for update;
  if not found then raise exception 'No active playing rules found'; end if;

  v_minimum_roles := (p_lineup_rules ->> 'min_batters')::integer
    + (p_lineup_rules ->> 'min_bowlers')::integer
    + (p_lineup_rules ->> 'min_wicketkeepers')::integer
    + (p_lineup_rules ->> 'min_all_rounders')::integer;
  if v_lineup_size < 1 or v_lineup_size > 30 then raise exception 'Lineup size must be between 1 and 30'; end if;
  if v_minimum_roles > v_lineup_size then raise exception 'Minimum roles exceed lineup size'; end if;
  if (p_lineup_rules ->> 'max_from_one_team')::integer > v_lineup_size then raise exception 'Team maximum exceeds lineup size'; end if;
  if (p_lineup_rules ->> 'lineup_budget')::numeric <= 0 then raise exception 'Lineup budget must be positive'; end if;
  if (p_lineup_rules ->> 'other_owner_penalty_percent')::numeric not between 0 and 100 then raise exception 'Other-owner penalty must be between 0 and 100'; end if;

  select coalesce(max(version), 0) + 1 into v_lineup_version
  from public.lineup_rule_sets where league_id = p_league_id;
  select coalesce(max(version), 0) + 1 into v_scoring_version
  from public.scoring_rule_sets where league_id = p_league_id;

  update public.lineup_rule_sets set active = false where league_id = p_league_id and active;
  update public.scoring_rule_sets set active = false where league_id = p_league_id and active;

  insert into public.lineup_rule_sets (
    league_id, version, name, lineup_size, lineup_budget,
    min_batters, min_bowlers, min_wicketkeepers, min_all_rounders, max_from_one_team,
    captain_multiplier, vice_captain_multiplier, impact_enabled, impact_multiplier,
    impact_batting_enabled, impact_bowling_enabled, impact_fielding_enabled, impact_bonus_enabled,
    impact_can_be_captain, carry_forward_enabled, reveal_lineups_after_lock,
    other_owner_penalty_percent, other_owner_minimum_penalty, active, created_by
  ) values (
    p_league_id, v_lineup_version, 'Playing rules v' || v_lineup_version,
    v_lineup_size, (p_lineup_rules ->> 'lineup_budget')::numeric,
    (p_lineup_rules ->> 'min_batters')::integer, (p_lineup_rules ->> 'min_bowlers')::integer,
    (p_lineup_rules ->> 'min_wicketkeepers')::integer, (p_lineup_rules ->> 'min_all_rounders')::integer,
    (p_lineup_rules ->> 'max_from_one_team')::integer,
    (p_lineup_rules ->> 'captain_multiplier')::numeric, (p_lineup_rules ->> 'vice_captain_multiplier')::numeric,
    v_current.impact_enabled, (p_lineup_rules ->> 'impact_multiplier')::numeric,
    v_current.impact_batting_enabled, v_current.impact_bowling_enabled,
    v_current.impact_fielding_enabled, v_current.impact_bonus_enabled,
    v_current.impact_can_be_captain, v_current.carry_forward_enabled,
    v_current.reveal_lineups_after_lock,
    (p_lineup_rules ->> 'other_owner_penalty_percent')::numeric,
    (p_lineup_rules ->> 'other_owner_minimum_penalty')::numeric,
    true, auth.uid()
  );

  insert into public.scoring_rule_sets (league_id, version, name, rules, active, created_by)
  values (p_league_id, v_scoring_version, 'Points rules v' || v_scoring_version, p_scoring_rules, true, auth.uid());

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (p_league_id, auth.uid(), 'league_rules_published', 'league', p_league_id::text,
          jsonb_build_object('lineup_version', v_lineup_version, 'scoring_version', v_scoring_version));

  return jsonb_build_object('lineup_version', v_lineup_version, 'scoring_version', v_scoring_version);
end;
$$;

revoke all on function public.publish_league_rules(uuid, jsonb, jsonb) from public;
grant execute on function public.publish_league_rules(uuid, jsonb, jsonb) to authenticated;

commit;
