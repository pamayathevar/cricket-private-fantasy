-- Resolve booster usage from configurable league phases instead of fixed match ranges.
begin;

create or replace function public.submit_lineup_with_booster(
  p_fixture_id uuid,
  p_player_ids uuid[],
  p_captain_player_id uuid,
  p_vice_captain_player_id uuid,
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
  v_lineup_id uuid;
  v_fixture public.fixtures%rowtype;
  v_lineup public.lineup_submissions%rowtype;
  v_booster public.booster_rules%rowtype;
  v_phase text;
  v_total_used integer;
  v_phase_used integer;
  v_phase_limit integer;
begin
  v_lineup_id := public.submit_lineup(
    p_fixture_id, p_player_ids, p_captain_player_id, p_vice_captain_player_id,
    p_impact_player_id, p_impact_type
  );

  select * into v_fixture from public.fixtures where id = p_fixture_id;
  select * into v_lineup from public.lineup_submissions where id = v_lineup_id;

  if p_booster_code is null then
    if p_booster_player_id is not null then raise exception 'A booster player cannot be supplied without a booster'; end if;
    delete from public.lineup_boosters where lineup_id = v_lineup_id;
    return v_lineup_id;
  end if;

  select * into v_booster from public.booster_rules
  where league_id = v_fixture.league_id and code = p_booster_code and active;
  if not found then raise exception 'Booster % is unavailable', p_booster_code; end if;

  if v_booster.usage_level = 'player' then
    if p_booster_player_id is null then raise exception '% requires a selected player', p_booster_code; end if;
    if not (p_booster_player_id = any(p_player_ids)) then raise exception 'Booster player must be selected in the XI'; end if;
  elsif p_booster_player_id is not null then
    raise exception '% is a match-level booster and cannot target a player', p_booster_code;
  end if;
  if p_booster_player_id = p_captain_player_id and not v_booster.allows_captain_stack then raise exception '% cannot be combined with Captain', p_booster_code; end if;
  if p_booster_player_id = p_vice_captain_player_id and not v_booster.allows_vice_captain_stack then raise exception '% cannot be combined with Vice-Captain', p_booster_code; end if;
  if p_booster_player_id = p_impact_player_id and not v_booster.allows_impact_stack then raise exception '% cannot be combined with BAI or BOI', p_booster_code; end if;

  select phase.code into v_phase
  from public.league_phases phase
  where phase.id = v_fixture.phase_id and phase.league_id = v_fixture.league_id and phase.active;
  if v_phase is null then raise exception 'Fixture is outside the configured booster phases'; end if;
  v_phase_limit := coalesce((v_booster.phase_usage_limits ->> v_phase)::integer, 0);
  if v_phase_limit <= 0 then raise exception '% is unavailable in %', p_booster_code, v_phase; end if;

  select count(*) into v_total_used from public.lineup_boosters booster_use
  where booster_use.member_id = v_lineup.member_id and booster_use.booster_rule_id = v_booster.id
    and booster_use.lineup_id <> v_lineup_id;
  if v_total_used >= v_booster.total_usage_limit then raise exception '% total usage limit has been reached', p_booster_code; end if;

  select count(*) into v_phase_used
  from public.lineup_boosters booster_use
  join public.fixtures fixture on fixture.id = booster_use.fixture_id
  join public.league_phases phase on phase.id = fixture.phase_id
  where booster_use.member_id = v_lineup.member_id and booster_use.booster_rule_id = v_booster.id
    and booster_use.lineup_id <> v_lineup_id and phase.code = v_phase;
  if v_phase_used >= v_phase_limit then raise exception '% usage limit for % has been reached', p_booster_code, v_phase; end if;

  insert into public.lineup_boosters (
    league_id, lineup_id, fixture_id, member_id, booster_rule_id, target_player_id
  ) values (
    v_fixture.league_id, v_lineup_id, p_fixture_id, v_lineup.member_id, v_booster.id, p_booster_player_id
  ) on conflict (lineup_id) do update set
    booster_rule_id = excluded.booster_rule_id, target_player_id = excluded.target_player_id,
    applied_adjustment = 0, calculation_breakdown = '{}'::jsonb, updated_at = now();

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_fixture.league_id, auth.uid(), 'lineup_booster_selected', 'lineup_submission', v_lineup_id::text,
    jsonb_build_object('booster', p_booster_code, 'target_player_id', p_booster_player_id, 'phase', v_phase));
  return v_lineup_id;
end;
$$;

revoke all on function public.submit_lineup_with_booster(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.submit_lineup_with_booster(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) to authenticated;

commit;
