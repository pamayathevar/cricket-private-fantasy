-- Read-only checks to run after the initial migration.
select slug, name, status, owner_limit, squad_limit,
       league_stage_transfer_limit, playoff_transfer_limit
from public.leagues
where slug = 'ipl-2026';

select display_name, email, role, status, user_id is not null as auth_linked
from public.league_members
where league_id = '10000000-0000-4000-8000-000000002026'
order by role, display_name;

select code, name
from public.cricket_teams
order by code;

select version, name, lineup_size, lineup_budget, min_batters, min_bowlers,
       min_wicketkeepers, min_all_rounders, max_from_one_team,
       captain_multiplier, vice_captain_multiplier, impact_enabled,
       carry_forward_enabled, reveal_lineups_after_lock, active
from public.lineup_rule_sets
where league_id = '10000000-0000-4000-8000-000000002026';

select version, name, active, rules
from public.scoring_rule_sets
where league_id = '10000000-0000-4000-8000-000000002026';

select version, name, active, created_at
from public.lineup_rule_sets
where league_id = '10000000-0000-4000-8000-000000002026'
order by version desc;

select version, name, active, created_at
from public.scoring_rule_sets
where league_id = '10000000-0000-4000-8000-000000002026'
order by version desc;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'leagues', 'league_members', 'cricket_teams', 'players', 'league_players',
    'fixtures', 'lineup_submissions', 'lineup_players', 'transfer_events', 'lineup_rule_sets',
    'scoring_rule_sets', 'player_match_points', 'member_match_scores', 'audit_events'
  )
order by tablename;

select count(*) as policy_count
from pg_policies
where schemaname = 'public';

select code, name, sort_order, start_match_number, end_match_number, active
from public.league_phases
where league_id = '10000000-0000-4000-8000-000000002026'
order by sort_order;

select phase_name, display_name, total_points, matches_scored, rank
from public.league_phase_standings
where league_id = '10000000-0000-4000-8000-000000002026'
order by phase_order, rank, display_name;

select code, name, usage_level, total_usage_limit, phase_usage_limits,
       player_multiplier, match_multiplier, unlimited_transfers,
       retain_changed_lineup, allows_captain_stack,
       allows_vice_captain_stack, allows_impact_stack
from public.booster_rules
where league_id = '10000000-0000-4000-8000-000000002026'
order by code;

-- Import checks. Expected: 268 total, 192 owned, 76 open.
select count(*) as total_players,
       count(*) filter (where lp.owner_member_id is not null) as owned_players,
       count(*) filter (where lp.owner_member_id is null) as open_players
from public.league_players lp
where lp.league_id = '10000000-0000-4000-8000-000000002026'
  and lp.active;

select coalesce(m.display_name, 'OpenPlayer') as owner,
       count(*) as player_count
from public.league_players lp
left join public.league_members m on m.id = lp.owner_member_id
where lp.league_id = '10000000-0000-4000-8000-000000002026'
  and lp.active
group by coalesce(m.display_name, 'OpenPlayer')
order by owner;

select t.code, count(*) as player_count
from public.league_players lp
join public.players p on p.id = lp.player_id
join public.cricket_teams t on t.id = p.team_id
where lp.league_id = '10000000-0000-4000-8000-000000002026'
  and lp.active
group by t.code
order by t.code;

-- Expected: 74 fixtures, match 1 at 2026-03-28 19:30 Asia/Kolkata.
select count(*) as fixture_count,
       min(match_number) as first_match,
       max(match_number) as last_match
from public.fixtures
where league_id = '10000000-0000-4000-8000-000000002026';

select f.match_number,
       phase.name as phase,
       home.code as team_1,
       away.code as team_2,
       f.scheduled_start at time zone 'Asia/Kolkata' as scheduled_start_ist,
       f.lineup_lock_at at time zone 'Asia/Kolkata' as lineup_lock_ist,
       f.status,
       f.scoring_status
from public.fixtures f
join public.league_phases phase on phase.id = f.phase_id
join public.cricket_teams home on home.id = f.home_team_id
join public.cricket_teams away on away.id = f.away_team_id
where f.league_id = '10000000-0000-4000-8000-000000002026'
order by f.match_number;

select f.match_number,
       f.stage,
       home.code as team_1,
       away.code as team_2,
       f.scheduled_start at time zone 'Asia/Kolkata' as scheduled_start_ist,
       f.venue
from public.fixtures f
join public.cricket_teams home on home.id = f.home_team_id
join public.cricket_teams away on away.id = f.away_team_id
where f.league_id = '10000000-0000-4000-8000-000000002026'
  and f.match_number between 71 and 74
order by f.match_number;
