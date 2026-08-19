-- Read-only verification for 20260817221734_score_ingestion_jobs.sql.
-- Run as a privileged SQL editor user after applying the migration.

select
  to_regclass('public.score_ingestion_jobs') is not null as score_ingestion_jobs_installed,
  exists (
    select 1
    from pg_class table_class
    join pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'score_ingestion_jobs'
      and table_class.relrowsecurity
  ) as row_level_security_enabled,
  to_regprocedure('public.request_score_ingestion_job(uuid,text,text)') is not null
    as request_rpc_installed,
  has_function_privilege(
    'authenticated',
    'public.request_score_ingestion_job(uuid,text,text)',
    'EXECUTE'
  ) as authenticated_can_request_import,
  not has_table_privilege('authenticated', 'public.score_ingestion_jobs', 'INSERT')
    as authenticated_cannot_insert_jobs,
  not has_table_privilege('authenticated', 'public.score_ingestion_jobs', 'UPDATE')
    as authenticated_cannot_update_jobs,
  not has_table_privilege('authenticated', 'public.score_ingestion_jobs', 'DELETE')
    as authenticated_cannot_delete_jobs,
  has_table_privilege('authenticated', 'public.score_ingestion_jobs', 'SELECT')
    as authenticated_can_read_authorized_jobs,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'score_ingestion_jobs'
      and policyname = 'score_ingestion_jobs_admin_select'
      and cmd = 'SELECT'
      and roles = array['authenticated']::name[]
  ) as admin_select_policy_installed;

select
  status,
  count(*) as jobs
from public.score_ingestion_jobs
group by status
order by status;

-- Rollback plan (do not run during verification):
-- drop function if exists public.request_score_ingestion_job(uuid, text, text);
-- drop table if exists public.score_ingestion_jobs;
