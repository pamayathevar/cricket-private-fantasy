select
  to_regprocedure('public.publish_league_transfer_periods(uuid,jsonb)') is not null as transfer_publish_rpc_installed,
  position('first transfer period must start at Match 1' in pg_get_functiondef(
    'public.publish_league_transfer_periods(uuid,jsonb)'::regprocedure
  )) > 0 as match_one_validation_installed,
  position('cannot have gaps between match ranges' in pg_get_functiondef(
    'public.publish_league_transfer_periods(uuid,jsonb)'::regprocedure
  )) > 0 as gap_validation_installed,
  position('must cover every fixture through Match' in pg_get_functiondef(
    'public.publish_league_transfer_periods(uuid,jsonb)'::regprocedure
  )) > 0 as fixture_coverage_validation_installed;

with ordered as (
  select league_id, start_match_number, end_match_number,
    lag(end_match_number) over (partition by league_id order by start_match_number, sort_order) as previous_end
  from public.league_transfer_periods
  where active
)
select
  league_id,
  min(start_match_number) as first_match,
  count(*) filter (where previous_end is not null and start_match_number <> previous_end + 1) as gaps
from ordered
group by league_id
order by league_id;
