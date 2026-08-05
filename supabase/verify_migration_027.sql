select
  to_regprocedure('public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)') is not null
    as transfer_rpc_installed,
  position('v_acquisition_mode = ''all_open''' in pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  )) > 0 as all_open_change_count_installed,
  position('v_fixture.match_number = v_period.start_match_number' in pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  )) > 0 as first_period_match_free_installed;

select
  format.acquisition_mode,
  period.code,
  period.name,
  period.start_match_number,
  period.end_match_number,
  period.transfer_limit,
  period.first_match_free
from public.league_format_configs format
join public.league_transfer_periods period on period.league_id = format.league_id and period.active
where format.league_id = '83fd878a-8e0c-402e-9c2e-2bae58836569'
order by period.sort_order;
