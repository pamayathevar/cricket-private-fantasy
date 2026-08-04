-- Configurable booster rules and server-validated lineup booster selection.
begin;

create table public.booster_rules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  code text not null check (code in ('3X', '2UP', 'SUP-TR')),
  name text not null,
  description text not null,
  usage_level text not null check (usage_level in ('player', 'match')),
  total_usage_limit integer not null check (total_usage_limit > 0),
  phase_usage_limits jsonb not null default '{}'::jsonb check (jsonb_typeof(phase_usage_limits) = 'object'),
  player_multiplier numeric(5,2) check (player_multiplier is null or player_multiplier > 0),
  match_multiplier numeric(5,2) check (match_multiplier is null or match_multiplier > 0),
  unlimited_transfers boolean not null default false,
  retain_changed_lineup boolean not null default false,
  allows_captain_stack boolean not null default false,
  allows_vice_captain_stack boolean not null default false,
  allows_impact_stack boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, code)
);

create table public.lineup_boosters (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  lineup_id uuid not null references public.lineup_submissions(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  booster_rule_id uuid not null references public.booster_rules(id) on delete restrict,
  target_player_id uuid references public.players(id) on delete restrict,
  applied_adjustment numeric(12,2) not null default 0,
  calculation_breakdown jsonb not null default '{}'::jsonb check (jsonb_typeof(calculation_breakdown) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lineup_id),
  unique (fixture_id, member_id)
);

create index lineup_boosters_member_rule_idx
  on public.lineup_boosters (member_id, booster_rule_id);

insert into public.booster_rules (
  id, league_id, code, name, description, usage_level,
  total_usage_limit, phase_usage_limits, player_multiplier, match_multiplier,
  unlimited_transfers, retain_changed_lineup,
  allows_captain_stack, allows_vice_captain_stack, allows_impact_stack
) values
(
  '60000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000002026',
  '3X', 'Triple Impact', 'Selected player receives three times their eligible fantasy points.', 'player',
  1, '{"phase1":1,"phase2":1,"phase3":1}'::jsonb, 3, null,
  false, false, true, true, true
),
(
  '60000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000002026',
  '2UP', 'Double Up', 'Doubles the owner total for the selected match.', 'match',
  2, '{"phase1":1,"phase2":1,"phase3":0}'::jsonb, null, 2,
  false, false, false, false, false
),
(
  '60000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000002026',
  'SUP-TR', 'Super Transfer', 'Unlimited transfers for one match; the changed lineup carries forward.', 'match',
  1, '{"phase1":1,"phase2":1,"phase3":1}'::jsonb, null, null,
  true, true, false, false, false
)
on conflict (league_id, code) do update
set name = excluded.name,
    description = excluded.description,
    usage_level = excluded.usage_level,
    total_usage_limit = excluded.total_usage_limit,
    phase_usage_limits = excluded.phase_usage_limits,
    player_multiplier = excluded.player_multiplier,
    match_multiplier = excluded.match_multiplier,
    unlimited_transfers = excluded.unlimited_transfers,
    retain_changed_lineup = excluded.retain_changed_lineup,
    allows_captain_stack = excluded.allows_captain_stack,
    allows_vice_captain_stack = excluded.allows_vice_captain_stack,
    allows_impact_stack = excluded.allows_impact_stack,
    active = true,
    updated_at = now();

create or replace function public.fixture_phase(p_match_number integer)
returns text
language sql
immutable
strict
as $$
  select case
    when p_match_number between 1 and 35 then 'phase1'
    when p_match_number between 36 and 70 then 'phase2'
    when p_match_number between 71 and 74 then 'phase3'
    else null
  end
$$;

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
    if p_booster_player_id is not null then
      raise exception 'A booster player cannot be supplied without a booster';
    end if;
    delete from public.lineup_boosters where lineup_id = v_lineup_id;
    return v_lineup_id;
  end if;

  select * into v_booster
  from public.booster_rules
  where league_id = v_fixture.league_id and code = p_booster_code and active;
  if not found then raise exception 'Booster % is unavailable', p_booster_code; end if;

  if v_booster.usage_level = 'player' then
    if p_booster_player_id is null then raise exception '% requires a selected player', p_booster_code; end if;
    if not (p_booster_player_id = any(p_player_ids)) then raise exception 'Booster player must be selected in the XI'; end if;
  elsif p_booster_player_id is not null then
    raise exception '% is a match-level booster and cannot target a player', p_booster_code;
  end if;

  if p_booster_player_id = p_captain_player_id and not v_booster.allows_captain_stack then
    raise exception '% cannot be combined with Captain', p_booster_code;
  end if;
  if p_booster_player_id = p_vice_captain_player_id and not v_booster.allows_vice_captain_stack then
    raise exception '% cannot be combined with Vice-Captain', p_booster_code;
  end if;
  if p_booster_player_id = p_impact_player_id and not v_booster.allows_impact_stack then
    raise exception '% cannot be combined with BAI or BOI', p_booster_code;
  end if;

  v_phase := public.fixture_phase(v_fixture.match_number);
  if v_phase is null then raise exception 'Fixture is outside the configured booster phases'; end if;
  v_phase_limit := coalesce((v_booster.phase_usage_limits ->> v_phase)::integer, 0);
  if v_phase_limit <= 0 then raise exception '% is unavailable in %', p_booster_code, v_phase; end if;

  select count(*) into v_total_used
  from public.lineup_boosters lb
  where lb.member_id = v_lineup.member_id
    and lb.booster_rule_id = v_booster.id
    and lb.lineup_id <> v_lineup_id;
  if v_total_used >= v_booster.total_usage_limit then
    raise exception '% total usage limit has been reached', p_booster_code;
  end if;

  select count(*) into v_phase_used
  from public.lineup_boosters lb
  join public.fixtures f on f.id = lb.fixture_id
  where lb.member_id = v_lineup.member_id
    and lb.booster_rule_id = v_booster.id
    and lb.lineup_id <> v_lineup_id
    and public.fixture_phase(f.match_number) = v_phase;
  if v_phase_used >= v_phase_limit then
    raise exception '% usage limit for % has been reached', p_booster_code, v_phase;
  end if;

  insert into public.lineup_boosters (
    league_id, lineup_id, fixture_id, member_id, booster_rule_id, target_player_id
  ) values (
    v_fixture.league_id, v_lineup_id, p_fixture_id, v_lineup.member_id, v_booster.id, p_booster_player_id
  )
  on conflict (lineup_id) do update
  set booster_rule_id = excluded.booster_rule_id,
      target_player_id = excluded.target_player_id,
      applied_adjustment = 0,
      calculation_breakdown = '{}'::jsonb,
      updated_at = now();

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (
    v_fixture.league_id, auth.uid(), 'lineup_booster_selected', 'lineup_submission', v_lineup_id::text,
    jsonb_build_object('booster', p_booster_code, 'target_player_id', p_booster_player_id, 'phase', v_phase)
  );

  return v_lineup_id;
end;
$$;

revoke all on function public.submit_lineup_with_booster(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.submit_lineup_with_booster(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) to authenticated;

alter table public.booster_rules enable row level security;
alter table public.lineup_boosters enable row level security;

create policy booster_rules_read on public.booster_rules for select to authenticated
  using (public.is_league_member(league_id));
create policy booster_rules_admin_all on public.booster_rules for all to authenticated
  using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy lineup_boosters_read on public.lineup_boosters for select to authenticated
  using (
    public.is_league_admin(league_id)
    or member_id = public.current_member_id(league_id)
    or (public.is_league_member(league_id) and exists (
      select 1 from public.fixtures f where f.id = fixture_id and now() >= f.lineup_lock_at
    ))
  );
create policy lineup_boosters_admin_all on public.lineup_boosters for all to authenticated
  using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));

grant select on public.booster_rules, public.lineup_boosters to authenticated;
grant insert, update, delete on public.booster_rules, public.lineup_boosters to authenticated;

commit;
