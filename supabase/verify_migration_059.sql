-- Expected: the first query returns all true and the remaining queries return no rows.
with definitions as (
  select
    pg_get_functiondef('public.settle_no_result_match(uuid)'::regprocedure) no_result_body,
    pg_get_functiondef(
      'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
    ) submission_body,
    pg_get_viewdef('public.league_standings'::regclass, true) standings_body,
    pg_get_viewdef('public.league_phase_standings'::regclass, true) phase_standings_body
)
select
  to_regprocedure('public.settle_no_result_match(uuid)') is not null
    as no_result_settlement_installed,
  to_regprocedure('public.settle_abandoned_match(uuid)') is not null
    as backward_compatible_entrypoint_installed,
  has_function_privilege('authenticated', 'public.settle_no_result_match(uuid)', 'EXECUTE')
    as authenticated_can_call_admin_checked_entrypoint,
  not has_function_privilege('anon', 'public.settle_no_result_match(uuid)', 'EXECUTE')
    as anonymous_cannot_settle,
  position($needle$status not in ('abandoned', 'cancelled')$needle$ in no_result_body) > 0
    as abandoned_and_cancelled_supported,
  position($needle$reason = 'abandoned_refund'$needle$ in no_result_body) > 0
    as refunded_transfer_history_preserved,
  position($needle$already_settled$needle$ in no_result_body) > 0
    as settlement_is_idempotent,
  position($needle$locked_lineups_recalculated$needle$ in no_result_body) > 0
    and position($needle$previous_lineup_id$needle$ in no_result_body) > 0
    and position($needle$transfers_after$needle$ in no_result_body) > 0
    as first_surviving_locked_xi_is_rebased,
  position($needle$fixture.status = 'scheduled'$needle$ in no_result_body) > 0
    as only_unlocked_future_fixtures_reset,
  position($needle$candidate.status = 'scheduled'$needle$ in submission_body) > 0
    and position('candidate.lineup_lock_at' in submission_body) > 0
    as only_earlier_unlocked_fixtures_block_submission,
  position($needle$period_fixture.status not in ('abandoned', 'cancelled')$needle$ in submission_body) > 0
    as first_valid_period_lineup_remains_free,
  position($needle$used_fixture.status not in ('abandoned', 'cancelled')$needle$ in submission_body) > 0
    as void_fixtures_excluded_from_transfer_usage,
  position('no_result' in standings_body) > 0
    and position('is distinct from' in lower(standings_body)) > 0
    as no_result_excluded_from_overall_matches_scored,
  position('no_result' in phase_standings_body) > 0
    and position('is distinct from' in lower(phase_standings_body)) > 0
    as no_result_excluded_from_phase_matches_scored
from definitions;

select fixture.match_number, fixture.status, lineup.member_id, lineup.status
from public.fixtures fixture
join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
where fixture.status in ('abandoned', 'cancelled')
  and fixture.scoring_status = 'published'
  and lineup.status in ('submitted', 'locked');

select fixture.match_number, event.member_id, event.transfer_count
from public.fixtures fixture
join public.transfer_events event on event.fixture_id = fixture.id
where fixture.status in ('abandoned', 'cancelled')
  and fixture.scoring_status = 'published'
  and event.reason = 'lineup_change';

select fixture.match_number, booster.member_id
from public.fixtures fixture
join public.lineup_boosters booster on booster.fixture_id = fixture.id
where fixture.status in ('abandoned', 'cancelled')
  and fixture.scoring_status = 'published';

select fixture.match_number, score.member_id, score.total_points, score.rank
from public.fixtures fixture
join public.member_match_scores score on score.fixture_id = fixture.id
where fixture.status in ('abandoned', 'cancelled')
  and fixture.scoring_status = 'published'
  and (score.total_points <> 0 or score.rank is not null);

-- Expected: no rows. Every completed settlement records whether a later
-- locked XI was rebased and preserves per-owner before/after evidence.
select audit.entity_id as fixture_id, audit.created_at
from public.audit_events audit
where audit.action = 'no_result_match_settled'
  and (
    not (audit.after_data ? 'locked_lineups_recalculated')
    or not (audit.after_data ? 'locked_transfers_before')
    or not (audit.after_data ? 'locked_transfers_after')
    or not (audit.after_data ? 'locked_recalculation_details')
  );

-- Expected: no rows. The active transfer charge on every rebased locked XI
-- must match the authoritative count written into the settlement audit.
select
  audit.entity_id as no_result_fixture_id,
  detail->>'member_id' as member_id,
  detail->>'match_number' as locked_match_number,
  (detail->>'transfers_after')::integer as expected_transfers,
  coalesce(sum(event.transfer_count), 0)::integer as active_transfers
from public.audit_events audit
cross join lateral jsonb_array_elements(
  coalesce(audit.after_data->'locked_recalculation_details', '[]'::jsonb)
) detail
left join public.lineup_submissions lineup
  on lineup.id = (detail->>'lineup_id')::uuid
left join public.transfer_events event
  on event.fixture_id = lineup.fixture_id
 and event.member_id = lineup.member_id
 and event.reason = 'lineup_change'
where audit.action = 'no_result_match_settled'
group by audit.entity_id, audit.created_at, detail
having coalesce(sum(event.transfer_count), 0)::integer
  <> (detail->>'transfers_after')::integer;
