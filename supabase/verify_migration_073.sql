-- Read-only verification for
-- 202608040073_materialize_locked_carry_forward_lineups.sql.
-- Every returned boolean must be true before the matching client is deployed.
select
  to_regprocedure('public.materialize_locked_fixture_lineups(uuid)') is not null
    as carry_forward_materializer_installed,
  has_function_privilege(
    'authenticated',
    'public.materialize_locked_fixture_lineups(uuid)',
    'EXECUTE'
  ) as authenticated_can_materialize_locked_fixture,
  not has_function_privilege(
    'anon',
    'public.materialize_locked_fixture_lineups(uuid)',
    'EXECUTE'
  ) as anonymous_cannot_materialize_lineups,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) ilike '%Active league membership required%'
    as active_membership_is_required,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) ilike '%Fixture has not reached its lineup lock%'
    as fixture_lock_is_required,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) ilike '%carry_forward_enabled%'
    as fixture_effective_carry_forward_rule_is_checked,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) ilike '%source_fixture.status not in (''abandoned'', ''cancelled'')%'
    as no_result_sources_are_excluded,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) ilike '%lineup.validation_status = ''valid''%'
    as only_valid_source_lineups_are_used,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) ilike '%on conflict (fixture_id, member_id) do nothing%'
    as materialization_is_idempotent,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) not ilike '%insert into public.lineup_boosters%'
    as boosters_are_not_carried,
  pg_get_functiondef(
    'public.materialize_locked_fixture_lineups(uuid)'::regprocedure
  ) not ilike '%insert into public.transfer_events%'
    as transfers_are_not_charged,
  pg_get_functiondef(
    'public.publish_match_scores_safe(uuid)'::regprocedure
  ) ilike '%materialize_locked_fixture_lineups(p_fixture_id)%'
    as score_publication_materializes_missing_lineups;
