select
  to_regprocedure('public.current_ipl_minimum_selection_cost(uuid)') is not null as minimum_cost_helper_installed,
  to_regprocedure('public.add_league_replacement_player(uuid,text,text,text,numeric,uuid)') is not null as guarded_add_rpc_installed,
  to_regprocedure('public.edit_league_player(uuid,text,text,numeric,uuid,boolean)') is not null as guarded_edit_rpc_installed,
  not has_function_privilege('authenticated', 'public.add_league_replacement_player_unchecked(uuid,text,text,text,numeric,uuid)', 'EXECUTE') as unchecked_add_not_client_callable,
  not has_function_privilege('authenticated', 'public.edit_league_player_unchecked(uuid,text,text,numeric,uuid,boolean)', 'EXECUTE') as unchecked_edit_not_client_callable,
  not has_function_privilege('anon', 'public.add_league_replacement_player(uuid,text,text,text,numeric,uuid)', 'EXECUTE') as anonymous_cannot_add,
  not has_function_privilege('anon', 'public.edit_league_player(uuid,text,text,numeric,uuid,boolean)', 'EXECUTE') as anonymous_cannot_edit;
