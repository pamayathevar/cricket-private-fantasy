-- READ-ONLY VERIFIER: VOLUME TEST MATCHES 11-20
-- Expected output:
--   1. First result row: every boolean is true.
--   2. Fixture detail: M11 and M13-M20 completed/published, M12
--      cancelled/published, M21 scheduled/pending on Aug 16.
--   3. Transfer mismatch result: zero rows.
--   4. Final No Result audit row: Match 12 and nine locked XIs recalculated.
begin;
set local statement_timeout = '60s';
set transaction read only;

with target as (
  select fixture.*
  from public.fixtures fixture
  where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and fixture.match_number between 11 and 21
)
select
  (
    select count(*)
    from public.lineup_submissions lineup
    join target fixture on fixture.id = lineup.fixture_id
    where fixture.match_number between 11 and 20
  ) = 90 as target_has_90_lineups,
  (
    select count(*)
    from public.lineup_submissions lineup
    join target fixture on fixture.id = lineup.fixture_id
    where fixture.match_number between 11 and 20
      and lineup.status = 'locked'
  ) = 81 as target_has_81_locked_lineups,
  (
    select count(*)
    from public.lineup_submissions lineup
    join target fixture on fixture.id = lineup.fixture_id
    where fixture.match_number = 12
      and lineup.status = 'cancelled'
  ) = 9 as match_12_has_9_cancelled_lineups,
  (
    select count(*)
    from public.lineup_players player
    join public.lineup_submissions lineup on lineup.id = player.lineup_id
    join target fixture on fixture.id = lineup.fixture_id
    where fixture.match_number between 11 and 20
  ) = 990 as target_has_990_lineup_players,
  (
    select count(*)
    from public.player_match_points points
    join target fixture on fixture.id = points.fixture_id
    where fixture.match_number between 11 and 20
      and points.published_at is not null
  ) = 216 as target_has_216_published_player_points,
  (
    select count(*)
    from public.member_match_scores score
    join target fixture on fixture.id = score.fixture_id
    where fixture.match_number between 11 and 20
  ) = 90 as target_has_90_owner_scores,
  (
    select count(*)
    from public.member_match_scores score
    join target fixture on fixture.id = score.fixture_id
    where fixture.match_number = 12
      and score.total_points = 0
      and score.rank is null
      and score.calculation_breakdown ->> 'no_result' = 'true'
  ) = 9 as match_12_has_9_zero_unranked_scores,
  (
    select count(*)
    from target fixture
    where fixture.match_number between 11 and 20
      and fixture.scoring_status = 'published'
  ) = 10 as all_10_target_matches_published,
  exists (
    select 1
    from target fixture
    where fixture.match_number = 12
      and fixture.status = 'cancelled'
      and fixture.scoring_status = 'published'
  ) as match_12_settled_as_no_result,
  exists (
    select 1
    from target fixture
    where fixture.match_number = 21
      and fixture.status = 'scheduled'
      and fixture.scoring_status = 'pending'
      and fixture.scheduled_start = '2026-08-16 14:00:00+00'::timestamptz
      and fixture.lineup_lock_at = '2026-08-16 14:00:00+00'::timestamptz
  ) as match_21_is_next_on_aug_16,
  (
    select count(*)
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 1 and 10
  ) = 90 as matches_1_10_preserved,
  (
    select count(*)
    from public.member_match_scores score
    join public.fixtures fixture on fixture.id = score.fixture_id
    where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and fixture.match_number between 1 and 10
  ) = 90 as matches_1_10_scores_preserved,
  exists (
    select 1
    from public.volume_test_match_backup backup
    where backup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and backup.label like 'pre-volume-test-m11-m20-%'
  ) as rollback_backup_exists,
  exists (
    select 1
    from public.audit_events audit
    join target fixture
      on fixture.id::text = audit.entity_id
     and fixture.match_number = 12
    where audit.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
      and audit.action = 'no_result_match_settled'
      and audit.entity_type = 'fixture'
      and (audit.after_data ->> 'locked_lineups_recalculated')::integer = 9
  ) as no_result_audit_rebased_all_owners;

select
  fixture.match_number,
  home.code as home,
  away.code as away,
  fixture.status,
  fixture.scoring_status,
  to_char(
    fixture.scheduled_start at time zone 'Asia/Kolkata',
    'YYYY-MM-DD HH24:MI'
  ) as start_ist,
  count(distinct lineup.id) as lineups,
  count(distinct score.id) as owner_scores,
  count(distinct points.id) filter (where points.published_at is not null) as published_player_points,
  fixture.scorecard_source_url
from public.fixtures fixture
join public.cricket_teams home on home.id = fixture.home_team_id
join public.cricket_teams away on away.id = fixture.away_team_id
left join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
left join public.member_match_scores score on score.fixture_id = fixture.id
left join public.player_match_points points on points.fixture_id = fixture.id
where fixture.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and fixture.match_number between 10 and 21
group by
  fixture.match_number, home.code, away.code, fixture.status,
  fixture.scoring_status, fixture.scheduled_start, fixture.scorecard_source_url
order by fixture.match_number;

-- The first valid XI before each target match is the authoritative baseline.
-- Match 13 must therefore compare with Match 11 because Match 12 is cancelled.
with current_lineups as (
  select
    lineup.id as lineup_id,
    lineup.league_id,
    lineup.member_id,
    fixture.id as fixture_id,
    fixture.match_number
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and fixture.match_number between 11 and 20
    and fixture.match_number <> 12
    and lineup.status in ('submitted', 'locked')
),
baselines as (
  select current.*,
         prior.lineup_id as prior_lineup_id,
         prior.match_number as prior_match_number
  from current_lineups current
  left join lateral (
    select
      prior_lineup.id as lineup_id,
      prior_fixture.match_number
    from public.lineup_submissions prior_lineup
    join public.fixtures prior_fixture on prior_fixture.id = prior_lineup.fixture_id
    where prior_lineup.league_id = current.league_id
      and prior_lineup.member_id = current.member_id
      and prior_lineup.status in ('submitted', 'locked')
      and prior_fixture.status not in ('abandoned', 'cancelled')
      and prior_fixture.match_number < current.match_number
    order by prior_fixture.match_number desc
    limit 1
  ) prior on true
),
expected as (
  select
    baseline.fixture_id,
    baseline.member_id,
    baseline.match_number,
    baseline.prior_match_number,
    count(*) filter (
      where league_player.owner_member_id is distinct from baseline.member_id
        and not exists (
          select 1
          from public.lineup_players prior_player
          where prior_player.lineup_id = baseline.prior_lineup_id
            and prior_player.player_id = current_player.player_id
        )
    )::integer as expected_transfers
  from baselines baseline
  join public.lineup_players current_player
    on current_player.lineup_id = baseline.lineup_id
  join public.league_players league_player
    on league_player.league_id = baseline.league_id
   and league_player.player_id = current_player.player_id
  group by
    baseline.fixture_id, baseline.member_id,
    baseline.match_number, baseline.prior_match_number
),
actual as (
  select
    event.fixture_id,
    event.member_id,
    coalesce(sum(event.transfer_count), 0)::integer as active_transfers
  from public.transfer_events event
  where event.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
    and event.reason = 'lineup_change'
  group by event.fixture_id, event.member_id
)
select
  expected.match_number,
  member.display_name as owner,
  expected.prior_match_number,
  expected.expected_transfers,
  coalesce(actual.active_transfers, 0) as active_transfers
from expected
join public.league_members member on member.id = expected.member_id
left join actual
  on actual.fixture_id = expected.fixture_id
 and actual.member_id = expected.member_id
where expected.expected_transfers <> coalesce(actual.active_transfers, 0)
order by expected.match_number, member.display_name;

select
  fixture.match_number,
  audit.after_data ->> 'member_count' as zero_score_owners,
  audit.after_data ->> 'transfers_refunded' as transfers_refunded,
  audit.after_data ->> 'locked_lineups_recalculated' as locked_lineups_recalculated,
  audit.after_data ->> 'locked_transfers_before' as match_13_transfers_before,
  audit.after_data ->> 'locked_transfers_after' as match_13_transfers_after,
  audit.created_at
from public.audit_events audit
join public.fixtures fixture
  on fixture.id::text = audit.entity_id
 and fixture.league_id = audit.league_id
where audit.league_id = '2fa606e1-2299-4c6d-9acf-348b7b858a49'
  and audit.action = 'no_result_match_settled'
  and audit.entity_type = 'fixture'
  and fixture.match_number = 12
order by audit.created_at desc
limit 1;

rollback;
