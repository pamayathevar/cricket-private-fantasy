-- Read-only verification for migration 033.
select
  to_regclass('public.phase_special_players') is not null as selection_table_installed,
  exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'league_phases' and column_name = 'is_final_phase') as final_phase_flag_installed,
  to_regprocedure('public.set_phase_special_players(uuid,text,uuid[])') is not null as selection_rpc_installed,
  to_regprocedure('public.player_power_restriction_reason(uuid,uuid,uuid,text)') is not null as restriction_resolver_installed,
  exists (select 1 from pg_trigger where tgname = 'enforce_special_lineup_markers_before_write' and not tgisinternal) as marker_trigger_installed,
  exists (select 1 from pg_trigger where tgname = 'enforce_special_3x_target_before_write' and not tgisinternal) as booster_trigger_installed,
  has_table_privilege('authenticated', 'public.phase_special_players', 'SELECT') as authenticated_can_read,
  not has_table_privilege('authenticated', 'public.phase_special_players', 'INSERT,UPDATE,DELETE') as direct_writes_blocked,
  not has_function_privilege('anon', 'public.set_phase_special_players(uuid,text,uuid[])', 'EXECUTE') as anonymous_cannot_select;

select league.name, phase.code, phase.name, phase.start_match_number, phase.end_match_number,
  phase.is_final_phase, public.phase_special_selection_deadline(phase.id) as selection_deadline
from public.league_phases phase
join public.leagues league on league.id = phase.league_id
where phase.active
order by league.name, phase.sort_order;
