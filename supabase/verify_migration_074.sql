-- Read-only verification for automatic fixture lifecycle migration 074.
-- Every returned boolean must be true.
select
  to_regprocedure('public.reconcile_due_fixture_lifecycle(uuid)') is not null
    as lifecycle_reconciliation_installed,
  has_function_privilege(
    'authenticated',
    'public.reconcile_due_fixture_lifecycle(uuid)',
    'EXECUTE'
  ) as members_can_reconcile,
  not has_function_privilege(
    'anon',
    'public.reconcile_due_fixture_lifecycle(uuid)',
    'EXECUTE'
  ) as anonymous_cannot_reconcile,
  pg_get_functiondef(
    'public.reconcile_due_fixture_lifecycle(uuid)'::regprocedure
  ) ilike '%Active league membership required%'
    as active_membership_is_required,
  pg_get_functiondef(
    'public.reconcile_due_fixture_lifecycle(uuid)'::regprocedure
  ) ilike '%fixture.league_id = p_league_id%'
    as reconciliation_is_league_scoped,
  pg_get_functiondef(
    'public.reconcile_due_fixture_lifecycle(uuid)'::regprocedure
  ) ilike '%fixture.lineup_lock_at <= clock_timestamp()%'
    as lock_timestamp_drives_transition,
  pg_get_functiondef(
    'public.reconcile_due_fixture_lifecycle(uuid)'::regprocedure
  ) ilike '%set status = ''live''%'
    as scheduled_fixture_becomes_live,
  pg_get_functiondef(
    'public.reconcile_due_fixture_lifecycle(uuid)'::regprocedure
  ) ilike '%lineup.status = ''submitted''%'
    as submitted_lineups_are_locked,
  pg_get_functiondef(
    'public.reconcile_due_fixture_lifecycle(uuid)'::regprocedure
  ) ilike '%materialize_locked_fixture_lineups(v_fixture.id)%'
    as missing_lineups_are_materialized;

-- Diagnostic only: after an active member opens each league, this should
-- return no rows for that league.
select fixture.league_id, fixture.match_number, fixture.lineup_lock_at
from public.fixtures fixture
where fixture.status = 'scheduled'
  and fixture.lineup_lock_at <= clock_timestamp()
order by fixture.league_id, fixture.match_number;
