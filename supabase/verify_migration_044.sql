-- Expected: all values are true.
with definition as (
  select pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  ) body
)
select
  position($check$candidate.status = 'scheduled'$check$ in body) > 0 as only_open_matches_block_submission,
  position('coalesce(candidate.lineup_lock_at, candidate.scheduled_start) > now()' in body) > 0 as locked_missed_matches_are_skipped,
  position('period_lineup.member_id = v_member_id' in body) > 0 as first_actual_period_lineup_is_free,
  position('period_fixture.match_number between v_period.start_match_number and v_period.end_match_number' in body) > 0 as free_reset_is_period_scoped
from definition;
