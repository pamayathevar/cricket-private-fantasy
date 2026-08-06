-- Per-owner phase selections and server-side power-player restrictions.
begin;

alter table public.league_phases
  add column if not exists is_final_phase boolean not null default false;

update public.league_phases phase
set is_final_phase = true
where phase.active and phase.sort_order = (
  select max(candidate.sort_order) from public.league_phases candidate
  where candidate.league_id = phase.league_id and candidate.active
);

create unique index league_phases_one_final_idx
  on public.league_phases (league_id) where active and is_final_phase;

create or replace function public.normalize_final_league_phase()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_league_id uuid := coalesce(new.league_id, old.league_id);
begin
  update public.league_phases set is_final_phase = false
  where league_id = v_league_id and is_final_phase;
  update public.league_phases set is_final_phase = true
  where id = (
    select id from public.league_phases
    where league_id = v_league_id and active
    order by sort_order desc limit 1
  );
  return null;
end;
$$;

drop trigger if exists normalize_final_league_phase_after_insert on public.league_phases;
create trigger normalize_final_league_phase_after_insert
after insert on public.league_phases
for each row execute function public.normalize_final_league_phase();
drop trigger if exists normalize_final_league_phase_after_update on public.league_phases;
create trigger normalize_final_league_phase_after_update
after update of active, sort_order on public.league_phases
for each row execute function public.normalize_final_league_phase();

create table public.phase_special_players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  phase_id uuid not null references public.league_phases(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  selection_type text not null check (selection_type in ('unique', 'marquee')),
  rule_set_id uuid not null references public.special_player_rule_sets(id) on delete restrict,
  selected_by uuid references auth.users(id),
  selected_at timestamptz not null default now(),
  unique (phase_id, member_id, player_id, selection_type)
);

create index phase_special_players_lookup_idx
  on public.phase_special_players (league_id, phase_id, selection_type, player_id);

create or replace function public.effective_phase_special_players(
  p_phase_id uuid, p_selection_type text
)
returns table(member_id uuid, player_id uuid, source_phase_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  with target as (
    select league_id, sort_order from public.league_phases where id = p_phase_id and active
  ), latest_by_member as (
    select selection.member_id, max(phase.sort_order) as phase_order
    from public.phase_special_players selection
    join public.league_phases phase on phase.id = selection.phase_id
    join target on target.league_id = phase.league_id and phase.sort_order <= target.sort_order
    where selection.selection_type = p_selection_type and phase.active
    group by selection.member_id
  )
  select selection.member_id, selection.player_id, selection.phase_id
  from public.phase_special_players selection
  join public.league_phases phase on phase.id = selection.phase_id
  join latest_by_member latest on latest.member_id = selection.member_id and latest.phase_order = phase.sort_order
  where selection.selection_type = p_selection_type
$$;

create or replace function public.phase_special_selection_deadline(p_phase_id uuid)
returns timestamptz
language sql
stable
security invoker
set search_path = public
as $$
  select first_fixture.scheduled_start
    - make_interval(hours => coalesce(rules.phase_change_deadline_hours, 24))
  from public.league_phases phase
  left join lateral (
    select min(fixture.scheduled_start) as scheduled_start
    from public.fixtures fixture
    where fixture.phase_id = phase.id
  ) first_fixture on true
  left join lateral public.special_player_rules_for_match(
    phase.league_id, phase.start_match_number
  ) rules on true
  where phase.id = p_phase_id
$$;

create or replace function public.set_phase_special_players(
  p_phase_id uuid,
  p_selection_type text,
  p_player_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_phase public.league_phases%rowtype;
  v_member_id uuid;
  v_rules public.special_player_rule_sets%rowtype;
  v_deadline timestamptz;
  v_required integer;
  v_distinct_count integer;
begin
  if p_selection_type not in ('unique', 'marquee') then raise exception 'Selection type must be unique or marquee'; end if;
  select * into v_phase from public.league_phases where id = p_phase_id and active;
  if not found then raise exception 'Active league phase not found'; end if;
  v_member_id := public.current_member_id(v_phase.league_id);
  if v_member_id is null then raise exception 'Active league membership required'; end if;
  if v_phase.is_final_phase then raise exception 'Unique and Marquee selections cannot be changed for the final phase'; end if;

  select * into v_rules from public.special_player_rules_for_match(v_phase.league_id, v_phase.start_match_number);
  if v_rules.id is null then raise exception 'Special-player rules are not configured for this phase'; end if;
  if p_selection_type = 'unique' and not v_rules.unique_mode_enabled then raise exception 'Unique-player mode is not enabled'; end if;
  if p_selection_type = 'marquee' and not v_rules.marquee_mode_enabled then raise exception 'Marquee mode is not enabled'; end if;
  v_required := case when p_selection_type = 'unique' then v_rules.unique_players_per_owner else v_rules.marquee_players_per_owner end;

  select public.phase_special_selection_deadline(v_phase.id) into v_deadline;
  if v_deadline is null then raise exception 'The phase must have fixtures before player selections can be saved'; end if;
  if now() >= v_deadline then raise exception '% selection closed at %', initcap(p_selection_type), v_deadline; end if;

  select count(distinct player_id) into v_distinct_count from unnest(p_player_ids) selected(player_id);
  if v_distinct_count <> v_required or coalesce(array_length(p_player_ids, 1), 0) <> v_required then
    raise exception 'Select exactly % % players', v_required, initcap(p_selection_type);
  end if;
  if exists (
    select 1 from unnest(p_player_ids) selected(player_id)
    left join public.league_players league_player
      on league_player.league_id = v_phase.league_id and league_player.player_id = selected.player_id
      and league_player.owner_member_id = v_member_id and league_player.active
    where league_player.id is null
  ) then raise exception 'Unique and Marquee selections must be active players owned by you'; end if;

  delete from public.phase_special_players
  where phase_id = v_phase.id and member_id = v_member_id and selection_type = p_selection_type;
  insert into public.phase_special_players (
    league_id, phase_id, member_id, player_id, selection_type, rule_set_id, selected_by
  ) select v_phase.league_id, v_phase.id, v_member_id, selected.player_id,
      p_selection_type, v_rules.id, auth.uid()
    from unnest(p_player_ids) selected(player_id);

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_phase.league_id, auth.uid(), 'phase_special_players_selected', 'league_phase', v_phase.id::text,
    jsonb_build_object('member_id', v_member_id, 'selection_type', p_selection_type,
      'player_ids', to_jsonb(p_player_ids), 'rule_set_id', v_rules.id, 'deadline', v_deadline));
  return jsonb_build_object('phase_id', v_phase.id, 'selection_type', p_selection_type,
    'selected_count', v_required, 'deadline', v_deadline);
end;
$$;

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

  if p_marker not in ('captain', 'vice_captain', 'impact', '3x') then raise exception 'Unknown power-player marker'; end if;
  v_marker_restricted := case p_marker
    when 'captain' then v_rules.unique_restrict_captain
    when 'vice_captain' then v_rules.unique_restrict_vice_captain
    when 'impact' then v_rules.unique_restrict_impact
    when '3x' then v_rules.unique_restrict_3x
    else false
  end;

  if v_rules.unique_mode_enabled
    and v_marker_restricted
    and exists (
    select 1 from public.effective_phase_special_players(v_fixture.phase_id, 'unique') selected
    where selected.player_id = p_player_id
  ) then return 'Phase Unique Player cannot be used as a power player'; end if;

  if v_rules.marquee_mode_enabled and v_rules.automatic_unique_enabled then
    select owner_member_id into v_owner_member_id from public.league_players
    where league_id = v_fixture.league_id and player_id = p_player_id and active;
    if v_owner_member_id is not null and v_owner_member_id <> p_member_id then
      select count(*) into v_usage_count
      from public.lineup_players lineup_player
      join public.lineup_submissions lineup on lineup.id = lineup_player.lineup_id
      join public.fixtures used_fixture on used_fixture.id = lineup.fixture_id
      where lineup.league_id = v_fixture.league_id and lineup_player.player_id = p_player_id
        and used_fixture.match_number < v_fixture.match_number
        and (used_fixture.status in ('live', 'completed', 'abandoned') or now() >= used_fixture.lineup_lock_at)
        and lineup.status in ('submitted', 'locked');
      if v_usage_count > v_rules.automatic_unique_usage_threshold and v_marker_restricted then
        return 'Automatically Unique Player cannot be used as a power player by another owner';
      end if;
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.enforce_special_lineup_markers()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_reason text;
begin
  if new.captain_player_id is not null then
    v_reason := public.player_power_restriction_reason(new.fixture_id, new.member_id, new.captain_player_id, 'captain');
    if v_reason is not null then raise exception 'Captain: %', v_reason; end if;
  end if;
  if new.vice_captain_player_id is not null then
    v_reason := public.player_power_restriction_reason(new.fixture_id, new.member_id, new.vice_captain_player_id, 'vice_captain');
    if v_reason is not null then raise exception 'Vice-Captain: %', v_reason; end if;
  end if;
  if new.impact_player_id is not null then
    v_reason := public.player_power_restriction_reason(new.fixture_id, new.member_id, new.impact_player_id, 'impact');
    if v_reason is not null then raise exception '%: %', new.impact_type, v_reason; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_special_lineup_markers_before_write on public.lineup_submissions;
create trigger enforce_special_lineup_markers_before_write
before insert or update of captain_player_id, vice_captain_player_id, impact_player_id, impact_type
on public.lineup_submissions for each row execute function public.enforce_special_lineup_markers();

create or replace function public.enforce_special_3x_target()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  v_reason text;
begin
  select code into v_code from public.booster_rules where id = new.booster_rule_id;
  if v_code = '3X' and new.target_player_id is not null then
    v_reason := public.player_power_restriction_reason(new.fixture_id, new.member_id, new.target_player_id, '3x');
    if v_reason is not null then raise exception '3X: %', v_reason; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_special_3x_target_before_write on public.lineup_boosters;
create trigger enforce_special_3x_target_before_write
before insert or update of booster_rule_id, target_player_id
on public.lineup_boosters for each row execute function public.enforce_special_3x_target();

alter table public.phase_special_players enable row level security;
create policy phase_special_players_read on public.phase_special_players
  for select to authenticated using (public.is_league_member(league_id));

grant select on public.phase_special_players to authenticated;
revoke insert, update, delete on public.phase_special_players from authenticated;
revoke all on function public.set_phase_special_players(uuid, text, uuid[]) from public;
grant execute on function public.set_phase_special_players(uuid, text, uuid[]) to authenticated;
grant execute on function public.phase_special_selection_deadline(uuid) to authenticated;
grant execute on function public.effective_phase_special_players(uuid, text) to authenticated;
revoke all on function public.player_power_restriction_reason(uuid, uuid, uuid, text) from public;
grant execute on function public.player_power_restriction_reason(uuid, uuid, uuid, text) to authenticated;

commit;
