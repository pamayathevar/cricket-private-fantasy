select
  to_regprocedure('public.publish_league_format(uuid,text,boolean,boolean,boolean,boolean,text,boolean)') is not null as format_rpc_installed,
  has_function_privilege('authenticated', 'public.publish_league_format(uuid,text,boolean,boolean,boolean,boolean,text,boolean)', 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', 'public.publish_league_format(uuid,text,boolean,boolean,boolean,boolean,text,boolean)', 'EXECUTE') as anonymous_cannot_execute;
