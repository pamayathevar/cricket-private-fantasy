begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  name text not null,
  competition text not null,
  season_year integer not null check (season_year between 2000 and 2200),
  status text not null default 'setup' check (status in ('setup', 'active', 'completed', 'archived')),
  timezone text not null default 'Asia/Kolkata',
  owner_limit integer not null default 10 check (owner_limit between 2 and 30),
  squad_limit integer not null default 30 check (squad_limit between 11 and 100),
  league_stage_transfer_limit integer not null default 105 check (league_stage_transfer_limit >= 0),
  playoff_transfer_limit integer not null default 6 check (playoff_transfer_limit >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email citext not null,
  display_name text not null,
  role text not null default 'owner' check (role in ('league_admin', 'owner', 'viewer')),
  status text not null default 'invited' check (status in ('invited', 'active', 'disabled')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, email),
  unique (league_id, user_id)
);

create table public.cricket_teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  external_ref text unique,
  full_name text not null,
  team_id uuid references public.cricket_teams(id) on delete set null,
  role text not null check (role in ('BA', 'BO', 'WK', 'AL')),
  overseas boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (full_name, team_id)
);

create table public.league_players (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  owner_member_id uuid references public.league_members(id) on delete set null,
  acquisition_type text not null default 'open' check (acquisition_type in ('open', 'auction', 'transfer', 'admin')),
  acquisition_price numeric(10,2) not null default 0 check (acquisition_price >= 0),
  active boolean not null default true,
  acquired_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, player_id)
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  external_ref text,
  match_number integer not null check (match_number > 0),
  stage text not null default 'league' check (stage in ('league', 'playoff', 'final')),
  home_team_id uuid not null references public.cricket_teams(id),
  away_team_id uuid not null references public.cricket_teams(id),
  scheduled_start timestamptz not null,
  lineup_lock_at timestamptz not null,
  venue text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'abandoned', 'cancelled')),
  scoring_status text not null default 'pending' check (scoring_status in ('pending', 'calculating', 'review', 'published', 'corrected')),
  scorecard_source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, match_number),
  unique (league_id, external_ref),
  check (home_team_id <> away_team_id),
  check (lineup_lock_at <= scheduled_start)
);

create table public.lineup_submissions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'locked', 'cancelled')),
  captain_player_id uuid not null references public.players(id),
  vice_captain_player_id uuid not null references public.players(id),
  impact_player_id uuid references public.players(id),
  impact_type text check (impact_type in ('BAI', 'BOI')),
  lineup_cost numeric(10,2) not null check (lineup_cost >= 0),
  borrowed_player_count integer not null default 0 check (borrowed_player_count >= 0),
  submitted_at timestamptz not null default now(),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, member_id),
  check (captain_player_id <> vice_captain_player_id),
  check ((impact_player_id is null and impact_type is null) or (impact_player_id is not null and impact_type is not null)),
  check (impact_player_id is null or (impact_player_id <> captain_player_id and impact_player_id <> vice_captain_player_id))
);

create table public.lineup_players (
  lineup_id uuid not null references public.lineup_submissions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  slot integer not null check (slot between 1 and 30),
  is_borrowed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (lineup_id, player_id),
  unique (lineup_id, slot)
);

create table public.transfer_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  fixture_id uuid references public.fixtures(id) on delete set null,
  player_out_id uuid references public.players(id),
  player_in_id uuid references public.players(id),
  stage text not null check (stage in ('league', 'playoff')),
  transfer_count integer not null default 1 check (transfer_count > 0),
  reason text not null default 'lineup_change' check (reason in ('lineup_change', 'admin_adjustment', 'abandoned_refund')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (player_out_id is not null or player_in_id is not null)
);

create table public.lineup_rule_sets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  lineup_size integer not null default 11 check (lineup_size between 1 and 30),
  lineup_budget numeric(10,2) not null default 100 check (lineup_budget > 0),
  min_batters integer not null default 2 check (min_batters >= 0),
  min_bowlers integer not null default 2 check (min_bowlers >= 0),
  min_wicketkeepers integer not null default 1 check (min_wicketkeepers >= 0),
  min_all_rounders integer not null default 1 check (min_all_rounders >= 0),
  max_from_one_team integer not null default 7 check (max_from_one_team > 0),
  captain_multiplier numeric(5,2) not null default 2 check (captain_multiplier >= 0),
  vice_captain_multiplier numeric(5,2) not null default 1.5 check (vice_captain_multiplier >= 0),
  impact_enabled boolean not null default true,
  impact_multiplier numeric(5,2) not null default 2 check (impact_multiplier >= 0),
  impact_batting_enabled boolean not null default true,
  impact_bowling_enabled boolean not null default true,
  impact_fielding_enabled boolean not null default false,
  impact_bonus_enabled boolean not null default false,
  impact_can_be_captain boolean not null default false,
  carry_forward_enabled boolean not null default true,
  reveal_lineups_after_lock boolean not null default true,
  other_owner_penalty_percent numeric(5,2) not null default 30 check (other_owner_penalty_percent between 0 and 100),
  other_owner_minimum_penalty numeric(10,2) not null default 15 check (other_owner_minimum_penalty >= 0),
  active boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (league_id, version),
  check (min_batters + min_bowlers + min_wicketkeepers + min_all_rounders <= lineup_size),
  check (max_from_one_team <= lineup_size)
);

create unique index one_active_lineup_rule_set_per_league
  on public.lineup_rule_sets (league_id) where active;

create table public.scoring_rule_sets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  version integer not null check (version > 0),
  name text not null,
  rules jsonb not null check (jsonb_typeof(rules) = 'object'),
  active boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (league_id, version)
);

create unique index one_active_scoring_rule_set_per_league
  on public.scoring_rule_sets (league_id) where active;

create table public.player_match_points (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rule_set_id uuid not null references public.scoring_rule_sets(id) on delete restrict,
  raw_stats jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_stats) = 'object'),
  breakdown jsonb not null default '{}'::jsonb check (jsonb_typeof(breakdown) = 'object'),
  batting_points numeric(12,2) not null default 0,
  bowling_points numeric(12,2) not null default 0,
  fielding_points numeric(12,2) not null default 0,
  bonus_points numeric(12,2) not null default 0,
  total_points numeric(12,2) generated always as (batting_points + bowling_points + fielding_points + bonus_points) stored,
  calculation_version integer not null default 1 check (calculation_version > 0),
  calculated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (fixture_id, player_id, calculation_version)
);

create table public.member_match_scores (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  lineup_id uuid not null references public.lineup_submissions(id) on delete cascade,
  base_points numeric(12,2) not null default 0,
  captain_bonus numeric(12,2) not null default 0,
  vice_captain_bonus numeric(12,2) not null default 0,
  impact_adjustment numeric(12,2) not null default 0,
  ownership_adjustment numeric(12,2) not null default 0,
  total_points numeric(12,2) generated always as (base_points + captain_bonus + vice_captain_bonus + impact_adjustment + ownership_adjustment) stored,
  rank integer check (rank is null or rank > 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fixture_id, member_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  league_id uuid references public.leagues(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index league_members_user_idx on public.league_members(user_id) where user_id is not null;
create index league_players_owner_idx on public.league_players(league_id, owner_member_id) where active;
create index fixtures_start_idx on public.fixtures(league_id, scheduled_start);
create index lineup_submissions_member_idx on public.lineup_submissions(member_id, fixture_id);
create index player_match_points_fixture_idx on public.player_match_points(fixture_id, player_id);
create index member_match_scores_member_idx on public.member_match_scores(member_id, fixture_id);
create index audit_events_league_idx on public.audit_events(league_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leagues_set_updated_at before update on public.leagues for each row execute function public.set_updated_at();
create trigger league_members_set_updated_at before update on public.league_members for each row execute function public.set_updated_at();
create trigger players_set_updated_at before update on public.players for each row execute function public.set_updated_at();
create trigger league_players_set_updated_at before update on public.league_players for each row execute function public.set_updated_at();
create trigger fixtures_set_updated_at before update on public.fixtures for each row execute function public.set_updated_at();
create trigger lineup_submissions_set_updated_at before update on public.lineup_submissions for each row execute function public.set_updated_at();
create trigger member_match_scores_set_updated_at before update on public.member_match_scores for each row execute function public.set_updated_at();

create or replace function public.link_auth_user_to_memberships()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.league_members
     set user_id = new.id,
         status = case when status = 'invited' then 'active' else status end,
         joined_at = coalesce(joined_at, now()),
         updated_at = now()
   where user_id is null
     and lower(email::text) = lower(new.email)
     and status in ('invited', 'active');
  return new;
end;
$$;

create trigger auth_user_links_memberships
after insert or update of email on auth.users
for each row execute function public.link_auth_user_to_memberships();

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_league_admin(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and status = 'active' and role = 'league_admin'
  );
$$;

create or replace function public.current_member_id(p_league_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.league_members
  where league_id = p_league_id and user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.is_any_league_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where user_id = auth.uid() and status = 'active' and role = 'league_admin'
  );
$$;

revoke all on function public.is_league_member(uuid) from public;
revoke all on function public.is_league_admin(uuid) from public;
revoke all on function public.current_member_id(uuid) from public;
revoke all on function public.is_any_league_admin() from public;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_admin(uuid) to authenticated;
grant execute on function public.current_member_id(uuid) to authenticated;
grant execute on function public.is_any_league_admin() to authenticated;

create or replace function public.submit_lineup(
  p_fixture_id uuid,
  p_player_ids uuid[],
  p_captain_player_id uuid,
  p_vice_captain_player_id uuid,
  p_impact_player_id uuid default null,
  p_impact_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_rules public.lineup_rule_sets%rowtype;
  v_member_id uuid;
  v_lineup_id uuid;
  v_unique_count integer;
  v_cost numeric(10,2);
  v_borrowed integer;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;

  select * into v_rules from public.lineup_rule_sets where league_id = v_fixture.league_id and active;
  if not found then raise exception 'No active lineup rule set is configured'; end if;
  v_member_id := public.current_member_id(v_fixture.league_id);
  if v_member_id is null then raise exception 'Active league membership required'; end if;
  if now() >= v_fixture.lineup_lock_at then raise exception 'Lineup is locked'; end if;
  if v_fixture.status not in ('scheduled') then raise exception 'Fixture is not open for team selection'; end if;
  if coalesce(array_length(p_player_ids, 1), 0) <> v_rules.lineup_size then raise exception 'Select exactly % players', v_rules.lineup_size; end if;

  select count(distinct player_id) into v_unique_count from unnest(p_player_ids) as chosen(player_id);
  if v_unique_count <> v_rules.lineup_size then raise exception 'Players must be unique'; end if;
  if p_captain_player_id = p_vice_captain_player_id then raise exception 'Captain and vice-captain must differ'; end if;
  if not (p_captain_player_id = any(p_player_ids) and p_vice_captain_player_id = any(p_player_ids)) then raise exception 'Captain and vice-captain must be selected'; end if;
  if (p_impact_player_id is null) <> (p_impact_type is null) then raise exception 'Impact player and type must be supplied together'; end if;
  if not v_rules.impact_enabled and p_impact_player_id is not null then raise exception 'Impact players are disabled for this league'; end if;
  if p_impact_type is not null and p_impact_type not in ('BAI', 'BOI') then raise exception 'Impact type must be BAI or BOI'; end if;
  if p_impact_type = 'BAI' and not v_rules.impact_batting_enabled then raise exception 'BAI is disabled for this league'; end if;
  if p_impact_type = 'BOI' and not v_rules.impact_bowling_enabled then raise exception 'BOI is disabled for this league'; end if;
  if p_impact_player_id is not null and not (p_impact_player_id = any(p_player_ids)) then raise exception 'Impact player must be selected'; end if;
  if not v_rules.impact_can_be_captain and p_impact_player_id in (p_captain_player_id, p_vice_captain_player_id) then raise exception 'Impact player cannot be captain or vice-captain'; end if;

  if (select count(*) from public.league_players lp where lp.league_id = v_fixture.league_id and lp.active and lp.player_id = any(p_player_ids)) <> v_rules.lineup_size then
    raise exception 'Every selected player must be active in this league';
  end if;
  if (select count(*) from public.players p where p.id = any(p_player_ids) and p.role = 'BA') < v_rules.min_batters then raise exception 'At least % batters required', v_rules.min_batters; end if;
  if (select count(*) from public.players p where p.id = any(p_player_ids) and p.role = 'BO') < v_rules.min_bowlers then raise exception 'At least % bowlers required', v_rules.min_bowlers; end if;
  if (select count(*) from public.players p where p.id = any(p_player_ids) and p.role = 'WK') < v_rules.min_wicketkeepers then raise exception 'At least % wicketkeepers required', v_rules.min_wicketkeepers; end if;
  if (select count(*) from public.players p where p.id = any(p_player_ids) and p.role = 'AL') < v_rules.min_all_rounders then raise exception 'At least % all-rounders required', v_rules.min_all_rounders; end if;
  if exists (select 1 from public.players p where p.id = any(p_player_ids) group by p.team_id having count(*) > v_rules.max_from_one_team) then raise exception 'Maximum % players from one cricket team', v_rules.max_from_one_team; end if;

  select coalesce(sum(acquisition_price), 0), count(*) filter (where owner_member_id is distinct from v_member_id)
    into v_cost, v_borrowed
    from public.league_players
   where league_id = v_fixture.league_id and active and player_id = any(p_player_ids);
  if v_cost > v_rules.lineup_budget then raise exception 'Lineup exceeds budget of %', v_rules.lineup_budget; end if;

  insert into public.lineup_submissions (
    league_id, fixture_id, member_id, status, captain_player_id, vice_captain_player_id,
    impact_player_id, impact_type, lineup_cost, borrowed_player_count, submitted_at
  ) values (
    v_fixture.league_id, p_fixture_id, v_member_id, 'submitted', p_captain_player_id, p_vice_captain_player_id,
    p_impact_player_id, p_impact_type, v_cost, v_borrowed, now()
  )
  on conflict (fixture_id, member_id) do update set
    status = 'submitted', captain_player_id = excluded.captain_player_id,
    vice_captain_player_id = excluded.vice_captain_player_id, impact_player_id = excluded.impact_player_id,
    impact_type = excluded.impact_type, lineup_cost = excluded.lineup_cost,
    borrowed_player_count = excluded.borrowed_player_count, submitted_at = now(), updated_at = now()
  returning id into v_lineup_id;

  delete from public.lineup_players where lineup_id = v_lineup_id;
  insert into public.lineup_players (lineup_id, player_id, slot, is_borrowed)
  select v_lineup_id, chosen.player_id, chosen.slot::integer, lp.owner_member_id is distinct from v_member_id
    from unnest(p_player_ids) with ordinality as chosen(player_id, slot)
    join public.league_players lp on lp.league_id = v_fixture.league_id and lp.player_id = chosen.player_id;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_fixture.league_id, auth.uid(), 'lineup_submitted', 'lineup_submission', v_lineup_id::text,
          jsonb_build_object('fixture_id', p_fixture_id, 'member_id', v_member_id));
  return v_lineup_id;
end;
$$;

revoke all on function public.submit_lineup(uuid, uuid[], uuid, uuid, uuid, text) from public;
grant execute on function public.submit_lineup(uuid, uuid[], uuid, uuid, uuid, text) to authenticated;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.cricket_teams enable row level security;
alter table public.players enable row level security;
alter table public.league_players enable row level security;
alter table public.fixtures enable row level security;
alter table public.lineup_submissions enable row level security;
alter table public.lineup_players enable row level security;
alter table public.transfer_events enable row level security;
alter table public.lineup_rule_sets enable row level security;
alter table public.scoring_rule_sets enable row level security;
alter table public.player_match_points enable row level security;
alter table public.member_match_scores enable row level security;
alter table public.audit_events enable row level security;

create policy leagues_read on public.leagues for select to authenticated using (public.is_league_member(id));
create policy leagues_admin_update on public.leagues for update to authenticated using (public.is_league_admin(id)) with check (public.is_league_admin(id));
create policy members_read on public.league_members for select to authenticated using (public.is_league_member(league_id));
create policy members_admin_insert on public.league_members for insert to authenticated with check (public.is_league_admin(league_id));
create policy members_admin_update on public.league_members for update to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy members_admin_delete on public.league_members for delete to authenticated using (public.is_league_admin(league_id));
create policy cricket_teams_read on public.cricket_teams for select to authenticated using (exists (select 1 from public.league_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy cricket_teams_admin_all on public.cricket_teams for all to authenticated using (public.is_any_league_admin()) with check (public.is_any_league_admin());
create policy players_read on public.players for select to authenticated using (exists (select 1 from public.league_members m where m.user_id = auth.uid() and m.status = 'active'));
create policy players_admin_all on public.players for all to authenticated using (public.is_any_league_admin()) with check (public.is_any_league_admin());
create policy league_players_read on public.league_players for select to authenticated using (public.is_league_member(league_id));
create policy league_players_admin_all on public.league_players for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy fixtures_read on public.fixtures for select to authenticated using (public.is_league_member(league_id));
create policy fixtures_admin_all on public.fixtures for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy lineups_read on public.lineup_submissions for select to authenticated using (
  public.is_league_admin(league_id)
  or member_id = public.current_member_id(league_id)
  or (public.is_league_member(league_id) and exists (
    select 1 from public.fixtures f
    join public.lineup_rule_sets r on r.league_id = f.league_id and r.active
    where f.id = fixture_id and r.reveal_lineups_after_lock and now() >= f.lineup_lock_at
  ))
);
create policy lineups_admin_all on public.lineup_submissions for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy lineup_players_read on public.lineup_players for select to authenticated using (exists (select 1 from public.lineup_submissions l where l.id = lineup_id));
create policy lineup_players_admin_all on public.lineup_players for all to authenticated using (exists (select 1 from public.lineup_submissions l where l.id = lineup_id and public.is_league_admin(l.league_id))) with check (exists (select 1 from public.lineup_submissions l where l.id = lineup_id and public.is_league_admin(l.league_id)));
create policy transfers_read on public.transfer_events for select to authenticated using (public.is_league_member(league_id));
create policy transfers_admin_all on public.transfer_events for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy lineup_rules_read on public.lineup_rule_sets for select to authenticated using (public.is_league_member(league_id));
create policy lineup_rules_admin_all on public.lineup_rule_sets for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy scoring_rules_read on public.scoring_rule_sets for select to authenticated using (public.is_league_member(league_id));
create policy scoring_rules_admin_all on public.scoring_rule_sets for all to authenticated using (public.is_league_admin(league_id)) with check (public.is_league_admin(league_id));
create policy player_points_read on public.player_match_points for select to authenticated using (exists (select 1 from public.fixtures f where f.id = fixture_id and public.is_league_member(f.league_id) and f.scoring_status in ('published', 'corrected')));
create policy player_points_admin_all on public.player_match_points for all to authenticated using (exists (select 1 from public.fixtures f where f.id = fixture_id and public.is_league_admin(f.league_id))) with check (exists (select 1 from public.fixtures f where f.id = fixture_id and public.is_league_admin(f.league_id)));
create policy member_scores_read on public.member_match_scores for select to authenticated using (exists (select 1 from public.fixtures f where f.id = fixture_id and public.is_league_member(f.league_id) and f.scoring_status in ('published', 'corrected')));
create policy member_scores_admin_all on public.member_match_scores for all to authenticated using (exists (select 1 from public.fixtures f where f.id = fixture_id and public.is_league_admin(f.league_id))) with check (exists (select 1 from public.fixtures f where f.id = fixture_id and public.is_league_admin(f.league_id)));
create policy audit_admin_read on public.audit_events for select to authenticated using (public.is_league_admin(league_id));

grant select on public.leagues, public.league_members, public.cricket_teams, public.players,
  public.league_players, public.fixtures, public.lineup_submissions, public.lineup_players,
  public.transfer_events, public.lineup_rule_sets, public.scoring_rule_sets, public.player_match_points,
  public.member_match_scores, public.audit_events to authenticated;
grant insert, update, delete on public.leagues, public.league_members, public.cricket_teams,
  public.players, public.league_players, public.fixtures, public.lineup_submissions,
  public.lineup_players, public.transfer_events, public.lineup_rule_sets, public.scoring_rule_sets,
  public.player_match_points, public.member_match_scores to authenticated;

create or replace view public.league_standings with (security_invoker = true) as
select m.league_id, m.id as member_id, m.display_name,
       coalesce(sum(s.total_points), 0)::numeric(14,2) as total_points,
       count(s.id) filter (where s.published_at is not null) as matches_scored,
       dense_rank() over (partition by m.league_id order by coalesce(sum(s.total_points), 0) desc) as rank
from public.league_members m
left join public.member_match_scores s on s.member_id = m.id and s.published_at is not null
where m.status = 'active' and m.role in ('league_admin', 'owner')
group by m.league_id, m.id, m.display_name;

grant select on public.league_standings to authenticated;

insert into public.leagues (
  id, slug, name, competition, season_year, status, timezone, owner_limit, squad_limit,
  league_stage_transfer_limit, playoff_transfer_limit
) values (
  '10000000-0000-4000-8000-000000002026', 'ipl-2026', 'IPL 2026', 'Indian Premier League', 2026,
  'active', 'Asia/Kolkata', 10, 30, 105, 6
) on conflict (slug) do nothing;

insert into public.lineup_rule_sets (
  id, league_id, version, name, lineup_size, lineup_budget,
  min_batters, min_bowlers, min_wicketkeepers, min_all_rounders, max_from_one_team,
  captain_multiplier, vice_captain_multiplier, impact_enabled, impact_multiplier,
  impact_batting_enabled, impact_bowling_enabled, impact_fielding_enabled, impact_bonus_enabled,
  impact_can_be_captain, carry_forward_enabled, reveal_lineups_after_lock,
  other_owner_penalty_percent, other_owner_minimum_penalty, active
) values (
  '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000002026', 1,
  'IPL 2026 playing rules v1', 11, 100, 2, 2, 1, 1, 7, 2, 1.5,
  true, 2, true, true, false, false, false, true, true, 30, 15, true
) on conflict (league_id, version) do nothing;

insert into public.scoring_rule_sets (id, league_id, version, name, rules, active)
values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000002026',
  1,
  'IPL 2026 scoring rules v1',
  '{
    "batting": {
      "run": 1,
      "four_bonus": 1,
      "six_bonus": 2,
      "run_milestones": [[25,2],[50,6],[75,12],[100,20],[125,30],[150,42],[175,56],[200,72],[225,90]],
      "duck_non_bowler": -2,
      "golden_or_diamond_duck_non_bowler": -4,
      "retired_out_treatment": "retired_hurt",
      "strike_rate_eligibility": {"minimum_balls": 10, "or_minimum_runs": 20},
      "strike_rate_bands": [[0,-12],[25,-8],[50,-4],[75,-2],[90,0],[100,2],[125,4],[150,8],[175,14],[225,22],[275,32],[325,44]]
    },
    "bowling": {
      "dismissed_bowler_wicket": 15,
      "dismissed_non_bowler_wicket": 20,
      "wicket_milestones": [[2,2],[3,6],[4,12],[5,20],[6,30],[7,42],[8,56],[9,72],[10,90]],
      "no_wicket_half_quota": -2,
      "no_wicket_full_quota": -4,
      "maiden": 10,
      "dot_ball": 2,
      "economy_minimum_balls": 6,
      "economy_bands": [[0,44],[1,32],[2,22],[3,14],[4,8],[5,4],[6,2],[7,0],[8,-2],[10,-4],[12,-8],[14,-12]],
      "hit_wicket_counts": true
    },
    "fielding": {"catch": 10, "stumping": 10, "run_out": 10, "shared_run_out": 8},
    "bonus": {"player_of_match": 15, "winning_participant": 2},
    "excluded": {"fours_or_sixes_conceded": true, "royalty_points": true}
  }'::jsonb,
  true
) on conflict (league_id, version) do nothing;

insert into public.league_members (id, league_id, email, display_name, role, status) values
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000002026', 'pandiyan.mayathevar@gmail.com', 'Pandiyan', 'league_admin', 'active'),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000002026', 'saransamy@gmail.com', 'Saravana', 'league_admin', 'active'),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000002026', 'sashi511@gmail.com', 'Sashi', 'owner', 'active'),
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000002026', 'jebarajsam@gmail.com', 'Jeba', 'owner', 'active'),
('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000002026', 'johnyamarnath@gmail.com', 'Johny', 'owner', 'active'),
('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000002026', 'tamilkrishna.info@gmail.com', 'Tamil', 'owner', 'active'),
('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000002026', 'muralikg24@gmail.com', 'Murali', 'owner', 'active'),
('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000002026', 'osa.mansurahamad@gmail.com', 'Mansur', 'owner', 'active'),
('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000002026', 'baluinfo@gmail.com', 'Bala', 'owner', 'active')
on conflict (league_id, email) do nothing;

insert into public.cricket_teams (id, code, name) values
('30000000-0000-4000-8000-000000000001', 'CSK', 'Chennai Super Kings'),
('30000000-0000-4000-8000-000000000002', 'DC', 'Delhi Capitals'),
('30000000-0000-4000-8000-000000000003', 'GT', 'Gujarat Titans'),
('30000000-0000-4000-8000-000000000004', 'KKR', 'Kolkata Knight Riders'),
('30000000-0000-4000-8000-000000000005', 'LSG', 'Lucknow Super Giants'),
('30000000-0000-4000-8000-000000000006', 'MI', 'Mumbai Indians'),
('30000000-0000-4000-8000-000000000007', 'PBKS', 'Punjab Kings'),
('30000000-0000-4000-8000-000000000008', 'RCB', 'Royal Challengers Bengaluru'),
('30000000-0000-4000-8000-000000000009', 'RR', 'Rajasthan Royals'),
('30000000-0000-4000-8000-000000000010', 'SRH', 'Sunrisers Hyderabad')
on conflict (code) do nothing;

update public.league_members m
   set user_id = u.id,
       joined_at = coalesce(m.joined_at, now())
  from auth.users u
 where m.user_id is null and lower(m.email::text) = lower(u.email);

commit;
