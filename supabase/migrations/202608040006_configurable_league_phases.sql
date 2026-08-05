-- Configurable league phases, fixture assignment and phase-wise standings.
begin;

create table public.league_phases (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_-]+$'),
  name text not null,
  sort_order integer not null check (sort_order > 0),
  start_match_number integer not null check (start_match_number > 0),
  end_match_number integer not null check (end_match_number >= start_match_number),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, code),
  unique (league_id, sort_order)
);

create or replace function public.validate_league_phase_range()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.active and exists (
    select 1
    from public.league_phases phase
    where phase.league_id = new.league_id
      and phase.active
      and phase.id <> new.id
      and int4range(phase.start_match_number, phase.end_match_number, '[]')
          && int4range(new.start_match_number, new.end_match_number, '[]')
  ) then
    raise exception 'League phase match ranges cannot overlap';
  end if;
  return new;
end;
$$;

create trigger validate_league_phase_range_before_write
before insert or update of league_id, start_match_number, end_match_number, active
on public.league_phases
for each row execute function public.validate_league_phase_range();

insert into public.league_phases (
  id, league_id, code, name, sort_order, start_match_number, end_match_number
) values
  ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000002026', 'phase1', 'Phase 1', 1, 1, 35),
  ('70000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000002026', 'phase2', 'Phase 2', 2, 36, 70),
  ('70000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000002026', 'phase3', 'Phase 3 · Playoffs', 3, 71, 74)
on conflict (league_id, code) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    start_match_number = excluded.start_match_number,
    end_match_number = excluded.end_match_number,
    active = true,
    updated_at = now();

alter table public.fixtures
  add column phase_id uuid references public.league_phases(id) on delete restrict;

update public.fixtures fixture
set phase_id = phase.id
from public.league_phases phase
where phase.league_id = fixture.league_id
  and phase.active
  and fixture.match_number between phase.start_match_number and phase.end_match_number;

create index fixtures_phase_idx on public.fixtures (phase_id, match_number);

create or replace function public.assign_fixture_phase()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select phase.id into new.phase_id
  from public.league_phases phase
  where phase.league_id = new.league_id
    and phase.active
    and new.match_number between phase.start_match_number and phase.end_match_number
  order by phase.sort_order
  limit 1;

  if new.phase_id is null then
    raise exception 'No active league phase covers match %', new.match_number;
  end if;
  return new;
end;
$$;

create trigger assign_fixture_phase_before_write
before insert or update of league_id, match_number
on public.fixtures
for each row execute function public.assign_fixture_phase();

create or replace function public.fixture_phase(p_league_id uuid, p_match_number integer)
returns text
language sql
stable
strict
as $$
  select phase.code
  from public.league_phases phase
  where phase.league_id = p_league_id
    and phase.active
    and p_match_number between phase.start_match_number and phase.end_match_number
  order by phase.sort_order
  limit 1
$$;

-- Compatibility for the currently installed IPL 2026 booster RPC.
create or replace function public.fixture_phase(p_match_number integer)
returns text
language sql
stable
strict
as $$
  select public.fixture_phase('10000000-0000-4000-8000-000000002026'::uuid, p_match_number)
$$;

create or replace view public.league_phase_standings with (security_invoker = true) as
select member.league_id,
       phase.id as phase_id,
       phase.code as phase_code,
       phase.name as phase_name,
       phase.sort_order as phase_order,
       member.id as member_id,
       member.display_name,
       coalesce(sum(score.total_points), 0)::numeric(14,2) as total_points,
       count(score.id) filter (where score.published_at is not null) as matches_scored,
       dense_rank() over (
         partition by member.league_id, phase.id
         order by coalesce(sum(score.total_points), 0) desc
       ) as rank
from public.league_members member
join public.league_phases phase
  on phase.league_id = member.league_id and phase.active
left join public.fixtures fixture on fixture.phase_id = phase.id
left join public.member_match_scores score
  on score.member_id = member.id
 and score.fixture_id = fixture.id
 and score.published_at is not null
where member.status = 'active' and member.role in ('league_admin', 'owner')
group by member.league_id, phase.id, phase.code, phase.name, phase.sort_order,
         member.id, member.display_name;

alter table public.league_phases enable row level security;

create policy league_phases_read on public.league_phases for select to authenticated
  using (public.is_league_member(league_id));
create policy league_phases_admin_all on public.league_phases for all to authenticated
  using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

grant select on public.league_phases, public.league_phase_standings to authenticated;
grant insert, update, delete on public.league_phases to authenticated;

commit;
