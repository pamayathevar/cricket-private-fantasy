select
  to_regprocedure('public.rename_league_member(uuid,uuid,text)') is not null as rename_rpc_installed,
  has_function_privilege('authenticated', 'public.rename_league_member(uuid,uuid,text)', 'EXECUTE') as authenticated_can_execute,
  not has_function_privilege('anon', 'public.rename_league_member(uuid,uuid,text)', 'EXECUTE') as anonymous_cannot_execute,
  to_regclass('public.league_members_unique_owner_name_ci') is not null as duplicate_name_guard_installed;
