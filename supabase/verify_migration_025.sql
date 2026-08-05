-- Read-only verification for audited admin league-player editing.
select
  to_regprocedure('public.edit_league_player(uuid,text,text,numeric,uuid,boolean)') is not null as edit_rpc_installed,
  has_function_privilege('authenticated', 'public.edit_league_player(uuid,text,text,numeric,uuid,boolean)', 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', 'public.edit_league_player(uuid,text,text,numeric,uuid,boolean)', 'EXECUTE') as anonymous_cannot_execute;
