select
  exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'submit_lineup_with_transfer_enforcement'
  ) as transfer_rpc_installed,
  exists (
    select 1
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'update_league_transfer_limits'
  ) as transfer_admin_rpc_installed;

select league_stage_transfer_limit, playoff_transfer_limit
from public.leagues
where id = '10000000-0000-4000-8000-000000002026';

select fixture.match_number, member.display_name,
  coalesce(sum(event.transfer_count), 0) transfers_this_match,
  league.league_stage_transfer_limit - coalesce(sum(sum(event.transfer_count)) over (
    partition by member.id order by fixture.match_number rows between unbounded preceding and current row
  ), 0) league_balance_after_match
from public.fixtures fixture
cross join public.league_members member
join public.leagues league on league.id = member.league_id
left join public.transfer_events event on event.fixture_id = fixture.id
  and event.member_id = member.id and event.stage = 'league' and event.reason = 'lineup_change'
where fixture.league_id = '10000000-0000-4000-8000-000000002026'
  and fixture.match_number between 1 and 5
  and member.status = 'active' and member.role in ('owner','league_admin')
group by fixture.match_number, member.id, member.display_name, league.league_stage_transfer_limit
order by fixture.match_number, member.display_name;
