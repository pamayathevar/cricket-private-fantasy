-- Expected: all values are true. The final query should return no rows.
with definition as (
  select pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  ) body
)
select
  to_regprocedure('public.reset_submitted_future_lineups(uuid,uuid,integer)') is not null
    as reset_helper_installed,
  to_regprocedure('public.recalculate_next_submitted_lineup_transfers(uuid,uuid,integer)') is null
    as superseded_recalculation_helper_removed,
  position('reset_submitted_future_lineups' in body) > 0
    as submission_resets_future_lineups,
  position('recalculate_next_submitted_lineup_transfers' in body) = 0
    as old_recalculation_hook_removed,
  not has_function_privilege(
    'authenticated',
    'public.reset_submitted_future_lineups(uuid,uuid,integer)',
    'EXECUTE'
  ) as helper_is_not_client_callable
from definition;

select
  league.name as league_name,
  member.display_name,
  fixture.match_number as submitted_match,
  previous_fixture.match_number as missing_previous_open_match
from public.lineup_submissions submission
join public.fixtures fixture on fixture.id = submission.fixture_id
join public.leagues league on league.id = submission.league_id
join public.league_members member on member.id = submission.member_id
join public.fixtures previous_fixture
  on previous_fixture.league_id = fixture.league_id
 and previous_fixture.match_number < fixture.match_number
 and previous_fixture.status = 'scheduled'
 and now() < coalesce(previous_fixture.lineup_lock_at, previous_fixture.scheduled_start)
where submission.status = 'submitted'
  and fixture.status = 'scheduled'
  and now() < coalesce(fixture.lineup_lock_at, fixture.scheduled_start)
  and not exists (
    select 1
    from public.lineup_submissions previous_submission
    where previous_submission.fixture_id = previous_fixture.id
      and previous_submission.member_id = submission.member_id
      and previous_submission.status in ('submitted', 'locked')
  )
order by league.name, member.display_name, fixture.match_number;
