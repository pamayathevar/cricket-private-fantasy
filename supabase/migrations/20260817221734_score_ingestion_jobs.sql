-- Record admin-requested URL imports separately from immutable reviewed score
-- artifacts. A background/Edge Function may prepare a review artifact, but it
-- cannot stage or publish scores through this table.
begin;

create table if not exists public.score_ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  source_url text not null check (
    source_url ~ '^https://'
    and length(source_url) between 12 and 2048
    and source_url !~ '[[:space:]]'
    and source_url !~* '[?&](access[_-]?token|api[_-]?key|apikey|auth(orization)?|credential|secret|signature|x-amz-[^=]*)='
  ),
  source_host text check (source_host is null or btrim(source_host) <> ''),
  provider_key text not null default 'auto' check (btrim(provider_key) <> ''),
  status text not null default 'queued' check (
    status in (
      'queued',
      'processing',
      'needs_configuration',
      'ready_for_review',
      'failed',
      'cancelled'
    )
  ),
  status_message text,
  error_code text,
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  review_artifact jsonb
    check (review_artifact is null or jsonb_typeof(review_artifact) = 'object'),
  warnings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings) = 'array'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status <> 'ready_for_review'
    or review_artifact is not null
  )
);

create index if not exists score_ingestion_jobs_league_status_idx
  on public.score_ingestion_jobs (league_id, status, created_at desc);
create index if not exists score_ingestion_jobs_fixture_created_idx
  on public.score_ingestion_jobs (fixture_id, created_at desc);

drop trigger if exists score_ingestion_jobs_set_updated_at
  on public.score_ingestion_jobs;
create trigger score_ingestion_jobs_set_updated_at
before update on public.score_ingestion_jobs
for each row execute function public.set_updated_at();

alter table public.score_ingestion_jobs enable row level security;

drop policy if exists score_ingestion_jobs_admin_select
  on public.score_ingestion_jobs;
create policy score_ingestion_jobs_admin_select
on public.score_ingestion_jobs
for select
to authenticated
using (public.is_league_admin(league_id));

-- Browser clients can request work only through the RPC below. The Edge
-- Function uses the service role to update processing results after it has
-- independently revalidated the caller and the source URL.
revoke all on table public.score_ingestion_jobs
  from public, anon, authenticated;
grant select on table public.score_ingestion_jobs to authenticated;

create or replace function public.request_score_ingestion_job(
  p_fixture_id uuid,
  p_source_url text,
  p_provider_key text default 'auto'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_job public.score_ingestion_jobs%rowtype;
  v_source_url text := btrim(coalesce(p_source_url, ''));
  v_provider_key text := lower(btrim(coalesce(p_provider_key, 'auto')));
begin
  select * into v_fixture
  from public.fixtures
  where id = p_fixture_id
  for share;

  if not found then
    raise exception 'Fixture not found';
  end if;
  if not public.is_league_admin(v_fixture.league_id) then
    raise exception 'League admin access required';
  end if;
  if v_fixture.status not in ('live', 'completed') then
    raise exception 'Only live or completed matches can be imported';
  end if;
  if v_source_url !~ '^https://'
     or length(v_source_url) not between 12 and 2048
     or v_source_url ~ '[[:space:]]'
     or v_source_url ~* '[?&](access[_-]?token|api[_-]?key|apikey|auth(orization)?|credential|secret|signature|x-amz-[^=]*)=' then
    raise exception 'A valid HTTPS score source URL is required';
  end if;
  if v_provider_key = '' or length(v_provider_key) > 64 then
    raise exception 'Provider key is invalid';
  end if;

  insert into public.score_ingestion_jobs (
    league_id,
    fixture_id,
    requested_by,
    source_url,
    provider_key
  ) values (
    v_fixture.league_id,
    p_fixture_id,
    auth.uid(),
    v_source_url,
    v_provider_key
  )
  returning * into v_job;

  insert into public.audit_events (
    league_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    v_fixture.league_id,
    auth.uid(),
    'score_ingestion_job_requested',
    'score_ingestion_job',
    v_job.id::text,
    jsonb_build_object(
      'fixture_id', p_fixture_id,
      'match_number', v_fixture.match_number,
      'provider_key', v_provider_key
    )
  );

  return jsonb_build_object(
    'job_id', v_job.id,
    'fixture_id', v_job.fixture_id,
    'status', v_job.status,
    'created_at', v_job.created_at
  );
end;
$$;

revoke all on function public.request_score_ingestion_job(uuid, text, text)
  from public, anon;
grant execute on function public.request_score_ingestion_job(uuid, text, text)
  to authenticated;

commit;
