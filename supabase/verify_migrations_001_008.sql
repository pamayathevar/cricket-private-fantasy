-- Read-only verification of migrations 001 through 008.
-- Safe to run repeatedly in the Supabase SQL Editor.
with migration_checks as (
  select 1 as migration_number, 'Initial schema' as migration_name,
         to_regclass('public.leagues') is not null
         and to_regclass('public.league_members') is not null
         and to_regclass('public.lineup_submissions') is not null
         and to_regclass('public.scoring_rule_sets') is not null as installed,
         'Core league, member, lineup and scoring tables' as expected

  union all
  select 2, 'IPL 2026 squad and league fixtures',
         (select count(*) > 0 from public.league_players where league_id = '10000000-0000-4000-8000-000000002026')
         and (select count(*) >= 70 from public.fixtures where league_id = '10000000-0000-4000-8000-000000002026'),
         'Imported players and at least 70 fixtures'

  union all
  select 3, 'IPL 2026 playoffs',
         (select count(*) = 4 from public.fixtures where league_id = '10000000-0000-4000-8000-000000002026' and match_number between 71 and 74),
         'Matches 71–74 exist'

  union all
  select 4, 'Boosters',
         to_regclass('public.booster_rules') is not null
         and to_regclass('public.lineup_boosters') is not null
         and to_regprocedure('public.submit_lineup_with_booster(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)') is not null,
         'Booster tables and submission RPC'

  union all
  select 5, 'Optional C/VC markers',
         coalesce((select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'lineup_submissions' and column_name = 'captain_player_id'), false)
         and coalesce((select is_nullable = 'YES' from information_schema.columns where table_schema = 'public' and table_name = 'lineup_submissions' and column_name = 'vice_captain_player_id'), false),
         'Captain and Vice-Captain columns are nullable'

  union all
  select 6, 'Configurable league phases',
         to_regclass('public.league_phases') is not null
         and to_regclass('public.league_phase_standings') is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fixtures' and column_name = 'phase_id'),
         'Phase table, ranking view and fixture link'

  union all
  select 7, 'Admin rule publishing',
         to_regprocedure('public.publish_league_rules(uuid,jsonb,jsonb)') is not null,
         'Versioned rule-publishing RPC'

  union all
  select 8, 'Admin phase publishing',
         to_regprocedure('public.publish_league_phases(uuid,jsonb)') is not null
         and to_regclass('public.one_active_phase_sort_order_per_league') is not null,
         'Phase-publishing RPC and active-order protection'
)
select lpad(migration_number::text, 3, '0') as migration,
       migration_name,
       case when installed then 'OK' else 'MISSING' end as status,
       expected,
       (select count(*) from public.league_members where league_id = '10000000-0000-4000-8000-000000002026') as members,
       (select count(*) from public.league_players where league_id = '10000000-0000-4000-8000-000000002026' and active) as players,
       (select count(*) from public.fixtures where league_id = '10000000-0000-4000-8000-000000002026') as fixtures
from migration_checks
order by migration_number;
