-- Read-only verification for admin replacement-player creation.
select
  to_regprocedure('public.add_league_replacement_player(uuid,text,text,text,numeric,uuid)') is not null as replacement_rpc_installed,
  has_function_privilege('authenticated', 'public.add_league_replacement_player(uuid,text,text,text,numeric,uuid)', 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', 'public.add_league_replacement_player(uuid,text,text,text,numeric,uuid)', 'EXECUTE') as anonymous_cannot_execute;
