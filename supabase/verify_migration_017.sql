select exists (
  select 1 from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'submit_lineup_with_booster'
) as dynamic_booster_rpc_installed;

select phase.code, phase.name, phase.start_match_number, phase.end_match_number,
  booster.code booster_code,
  coalesce((booster.phase_usage_limits ->> phase.code)::integer, 0) usage_limit
from public.league_phases phase
cross join public.booster_rules booster
where phase.league_id = '10000000-0000-4000-8000-000000002026' and phase.active
  and booster.league_id = phase.league_id and booster.active
order by phase.sort_order, booster.code;
