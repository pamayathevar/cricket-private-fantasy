-- Expected: all values are true. The final query should return no rows.
with definition as (
  select pg_get_functiondef(
    'public.submit_lineup_with_transfer_result(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  ) body
)
select
  position('submit_lineup_with_transfer_enforcement' in body) > 0
    as wrapper_uses_enforced_submission,
  position($needle$event.fixture_id = p_fixture_id$needle$ in body) > 0
    as result_reads_current_fixture_event,
  position($needle$event.reason = 'lineup_change'$needle$ in body) > 0
    as result_reads_lineup_transfers,
  has_function_privilege(
    'authenticated',
    'public.submit_lineup_with_transfer_result(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) as authenticated_can_submit,
  not has_function_privilege(
    'anon',
    'public.submit_lineup_with_transfer_result(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) as anonymous_cannot_submit
from definition;

with expected as (
  select
    lineup.id as lineup_id,
    coalesce((
      select sum(event.transfer_count)::integer
      from public.transfer_events event
      where event.league_id = lineup.league_id
        and event.member_id = lineup.member_id
        and event.fixture_id = lineup.fixture_id
        and event.reason = 'lineup_change'
    ), 0) as database_transfer_count
  from public.lineup_submissions lineup
)
select expected.lineup_id, expected.database_transfer_count
from expected
where expected.database_transfer_count < 0;
