-- Read-only verification for league-specific player availability.
select
  to_regprocedure('public.set_league_player_active(uuid,boolean)') is not null as availability_rpc_installed,
  has_function_privilege('authenticated', 'public.set_league_player_active(uuid,boolean)', 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', 'public.set_league_player_active(uuid,boolean)', 'EXECUTE') as anonymous_cannot_execute;
