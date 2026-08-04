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
