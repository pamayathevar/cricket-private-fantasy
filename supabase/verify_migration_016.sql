select
  to_regclass('public.league_transfer_periods') is not null as periods_table_installed,
  exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'publish_league_transfer_periods') as publishing_rpc_installed,
  has_table_privilege('authenticated', 'public.league_transfer_periods', 'SELECT') as authenticated_can_select;

select code, name, start_match_number, end_match_number, transfer_limit, first_match_free, active
from public.league_transfer_periods
where league_id = '10000000-0000-4000-8000-000000002026'
order by sort_order;

select count(*) as transfer_events_without_period
from public.transfer_events event
join public.fixtures fixture on fixture.id = event.fixture_id
where event.league_id = '10000000-0000-4000-8000-000000002026'
  and event.reason = 'lineup_change' and event.transfer_period_id is null;
