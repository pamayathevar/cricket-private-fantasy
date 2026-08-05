select
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lineup_submissions'
      and policyname = 'lineups_read'
      and cmd = 'SELECT'
      and qual not like '%is_league_admin%'
  ) as admin_prelock_bypass_removed,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lineup_players'
      and policyname = 'lineup_players_read' and cmd = 'SELECT'
  ) as player_privacy_policy_installed,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lineup_boosters'
      and policyname = 'lineup_boosters_read'
      and cmd = 'SELECT'
      and qual not like '%is_league_admin%'
  ) as booster_privacy_policy_installed,
  not has_table_privilege('authenticated', 'public.lineup_submissions', 'INSERT')
    and not has_table_privilege('authenticated', 'public.lineup_submissions', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.lineup_submissions', 'DELETE')
    as direct_lineup_writes_blocked,
  not has_table_privilege('authenticated', 'public.lineup_players', 'INSERT')
    and not has_table_privilege('authenticated', 'public.lineup_players', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.lineup_players', 'DELETE')
    as direct_player_writes_blocked,
  not has_table_privilege('authenticated', 'public.lineup_boosters', 'INSERT')
    and not has_table_privilege('authenticated', 'public.lineup_boosters', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.lineup_boosters', 'DELETE')
    as direct_booster_writes_blocked,
  position('now() >= v_fixture.lineup_lock_at' in pg_get_functiondef(
    'public.submit_lineup(uuid,uuid[],uuid,uuid,uuid,text)'::regprocedure
  )) > 0 as rpc_lock_check_installed,
  position('v_fixture.status not in (''scheduled'')' in pg_get_functiondef(
    'public.submit_lineup(uuid,uuid[],uuid,uuid,uuid,text)'::regprocedure
  )) > 0 as rpc_fixture_status_check_installed;
