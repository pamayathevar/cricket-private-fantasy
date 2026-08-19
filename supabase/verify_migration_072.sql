-- Read-only verification for 202608040072_score_ingestion_batches.sql.
-- Every returned boolean must be true before the matching client is deployed.
select
  to_regclass('public.score_ingestion_batches') is not null
    as score_ingestion_batches_installed,
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.score_ingestion_batches'::regclass
  ), false) as batch_rls_enabled,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'score_ingestion_batches'
      and policyname = 'score_ingestion_batches_admin_select'
      and cmd = 'SELECT'
  ) as admin_read_policy_installed,
  has_table_privilege('authenticated', 'public.score_ingestion_batches', 'SELECT')
    as authenticated_can_read_batches,
  not has_table_privilege('authenticated', 'public.score_ingestion_batches', 'INSERT')
    and not has_table_privilege('authenticated', 'public.score_ingestion_batches', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.score_ingestion_batches', 'DELETE')
    as authenticated_cannot_write_batches_directly,
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.score_ingestion_batches'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%fixture_id, source_fingerprint%'
  ) as fixture_fingerprint_is_unique,
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.score_ingestion_batches'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%fixture_id, calculation_version%'
  ) as fixture_calculation_version_is_unique;

select
  to_regprocedure('public.stage_score_ingestion_batch(uuid,jsonb,text)') is not null
    as validated_batch_rpc_installed,
  has_function_privilege(
    'authenticated',
    'public.stage_score_ingestion_batch(uuid,jsonb,text)',
    'EXECUTE'
  ) as authenticated_can_stage_validated_batch,
  not has_function_privilege(
    'anon',
    'public.stage_score_ingestion_batch(uuid,jsonb,text)',
    'EXECUTE'
  ) as anon_cannot_stage_batch,
  not has_function_privilege(
    'authenticated',
    'public.stage_match_player_points(uuid,jsonb)',
    'EXECUTE'
  ) as authenticated_cannot_bypass_batch_validation,
  not has_function_privilege(
    'anon',
    'public.stage_match_player_points(uuid,jsonb)',
    'EXECUTE'
  ) as anon_cannot_stage_raw_points,
  pg_get_functiondef(
    'public.stage_score_ingestion_batch(uuid,jsonb,text)'::regprocedure
  ) ilike '%is_league_admin%'
    as batch_rpc_requires_league_admin,
  pg_get_functiondef(
    'public.stage_score_ingestion_batch(uuid,jsonb,text)'::regprocedure
  ) ilike '%source_fingerprint%'
    as batch_rpc_validates_source_fingerprint,
  pg_get_functiondef(
    'public.stage_score_ingestion_batch(uuid,jsonb,text)'::regprocedure
  ) ilike '%Review notes are required%'
    as warning_review_notes_enforced,
  pg_get_functiondef(
    'public.publish_match_scores_safe(uuid)'::regprocedure
  ) ilike '%update public.score_ingestion_batches%'
    as publication_updates_batch_status;
