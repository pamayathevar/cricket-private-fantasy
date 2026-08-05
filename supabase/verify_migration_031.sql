select
  to_regprocedure('public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)') is not null
    as submission_rpc_installed,
  position('Submit Match % before submitting Match %' in pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  )) > 0 as sequential_submission_check_installed,
  position('v_missing_fixture.match_number, v_fixture.match_number' in pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  )) > 0 as specific_match_error_installed,
  has_function_privilege(
    'authenticated',
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) as authenticated_can_execute,
  not has_function_privilege(
    'anon',
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) as anonymous_cannot_execute;

-- Read-only audit: any rows returned are existing skipped submissions that were
-- created before this migration and should be reviewed explicitly.
select
  league.name as league_name,
  member.display_name,
  fixture.match_number as submitted_match,
  previous_fixture.match_number as missing_previous_match
from public.lineup_submissions submission
join public.fixtures fixture on fixture.id = submission.fixture_id
join public.leagues league on league.id = submission.league_id
join public.league_members member on member.id = submission.member_id
join public.fixtures previous_fixture
  on previous_fixture.league_id = fixture.league_id
 and previous_fixture.match_number < fixture.match_number
where submission.status in ('submitted', 'locked')
  and not exists (
    select 1
    from public.lineup_submissions previous_submission
    where previous_submission.fixture_id = previous_fixture.id
      and previous_submission.member_id = submission.member_id
      and previous_submission.status in ('submitted', 'locked')
  )
order by league.name, member.display_name, fixture.match_number;
