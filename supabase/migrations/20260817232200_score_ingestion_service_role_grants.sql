-- Edge Functions authenticate callers with the user JWT, then use the
-- service-role client for the narrow set of trusted ingestion operations
-- below. Keep these grants explicit because this project revokes broad
-- default table privileges.
begin;

grant select
  on table public.fixtures, public.cricket_teams
  to service_role;

grant select, update
  on table public.score_ingestion_jobs
  to service_role;

grant insert
  on table public.audit_events
  to service_role;

commit;
