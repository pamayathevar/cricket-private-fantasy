-- Add an idempotent, auditable boundary between compiled score artifacts and
-- the existing score-review/publication pipeline.
begin;

create table if not exists public.score_ingestion_batches (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  source_provider text not null check (btrim(source_provider) <> ''),
  external_match_id text not null check (btrim(external_match_id) <> ''),
  source_url text not null check (source_url ~ '^https://'),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  artifact_schema_version integer not null check (artifact_schema_version = 1),
  rule_set_id uuid not null references public.scoring_rule_sets(id),
  review_artifact jsonb not null check (jsonb_typeof(review_artifact) = 'object'),
  reconciliation jsonb not null check (jsonb_typeof(reconciliation) = 'object'),
  warning_count integer not null default 0 check (warning_count >= 0),
  review_notes text,
  status text not null default 'staged' check (status in ('staged', 'published', 'superseded')),
  calculation_version integer not null check (calculation_version > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (fixture_id, source_fingerprint),
  unique (fixture_id, calculation_version)
);

create index if not exists score_ingestion_batches_league_status_idx
  on public.score_ingestion_batches (league_id, status, created_at desc);
create index if not exists score_ingestion_batches_fixture_created_idx
  on public.score_ingestion_batches (fixture_id, created_at desc);

alter table public.score_ingestion_batches enable row level security;

drop policy if exists score_ingestion_batches_admin_select on public.score_ingestion_batches;
create policy score_ingestion_batches_admin_select
on public.score_ingestion_batches
for select
to authenticated
using (public.is_league_admin(league_id));

revoke all on table public.score_ingestion_batches from public, anon, authenticated;
grant select on table public.score_ingestion_batches to authenticated;

create or replace function public.stage_score_ingestion_batch(
  p_fixture_id uuid,
  p_artifact jsonb,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_rule_set_id uuid;
  v_existing public.score_ingestion_batches%rowtype;
  v_stage_result jsonb;
  v_payload jsonb;
  v_reconciliation jsonb;
  v_source jsonb;
  v_issues jsonb;
  v_fingerprint text;
  v_warning_count integer;
  v_player_count integer;
  v_expected_player_count integer;
  v_duplicate_count integer;
  v_invalid_count integer;
  v_batting numeric;
  v_bowling numeric;
  v_fielding numeric;
  v_bonus numeric;
  v_total numeric;
  v_batch_id uuid;
  v_canonical_existing jsonb;
  v_canonical_incoming jsonb;
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
begin
  select * into v_fixture
  from public.fixtures
  where id = p_fixture_id
  for update;

  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_admin(v_fixture.league_id) then raise exception 'League admin access required'; end if;
  if v_fixture.status not in ('live', 'completed') then
    raise exception 'Only live or completed matches can be staged';
  end if;

  if jsonb_typeof(p_artifact) is distinct from 'object' then
    raise exception 'Score review artifact must be a JSON object';
  end if;
  if p_artifact->>'schemaVersion' <> '1' or p_artifact->>'status' <> 'ready-for-admin-review' then
    raise exception 'Unsupported or unreviewable score artifact';
  end if;
  if p_artifact->>'leagueId' is distinct from v_fixture.league_id::text
     or p_artifact->>'fixtureId' is distinct from p_fixture_id::text
     or p_artifact->>'matchNumber' is distinct from v_fixture.match_number::text then
    raise exception 'Artifact league, fixture, or match number does not match the selected fixture';
  end if;

  v_fingerprint := lower(coalesce(p_artifact->>'sourceFingerprint', ''));
  if v_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Artifact source fingerprint must be a 64-character SHA-256 value';
  end if;

  v_source := p_artifact->'source';
  if jsonb_typeof(v_source) is distinct from 'object'
     or btrim(coalesce(v_source->>'provider', '')) = ''
     or btrim(coalesce(v_source->>'externalMatchId', '')) = ''
     or coalesce(v_source->>'sourceUrl', '') !~ '^https://' then
    raise exception 'Artifact source requires provider, external match ID, and an HTTPS URL';
  end if;

  if coalesce(p_artifact->>'ruleSetId', '') !~* v_uuid_pattern then
    raise exception 'Artifact rule-set ID is invalid';
  end if;
  v_rule_set_id := public.scoring_rule_set_for_fixture(p_fixture_id);
  if v_rule_set_id is null then raise exception 'No points rules apply to this fixture'; end if;
  if (p_artifact->>'ruleSetId')::uuid <> v_rule_set_id then
    raise exception 'Artifact rule set does not match the fixture-effective points rules';
  end if;

  v_issues := p_artifact->'issues';
  if jsonb_typeof(v_issues) is distinct from 'array' then
    raise exception 'Artifact issues must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_issues) issue
    where lower(coalesce(issue->>'severity', '')) = 'error'
  ) then
    raise exception 'Artifact contains validation errors and cannot be staged';
  end if;
  select count(*) into v_warning_count
  from jsonb_array_elements(v_issues) issue
  where lower(coalesce(issue->>'severity', '')) = 'warning';
  if v_warning_count > 0 and btrim(coalesce(p_review_notes, '')) = '' then
    raise exception 'Review notes are required when the artifact contains warnings';
  end if;

  v_payload := p_artifact->'stagingPayload';
  v_reconciliation := p_artifact->'reconciliation';
  if jsonb_typeof(v_payload) is distinct from 'array' or jsonb_array_length(v_payload) = 0 then
    raise exception 'Artifact staging payload must be a non-empty array';
  end if;
  if jsonb_typeof(v_reconciliation) is distinct from 'object' then
    raise exception 'Artifact reconciliation must be an object';
  end if;

  select count(*) into v_invalid_count
  from jsonb_array_elements(v_payload) item
  where jsonb_typeof(item) is distinct from 'object'
     or coalesce(item->>'player_id', '') !~* v_uuid_pattern
     or jsonb_typeof(item->'raw_stats') is distinct from 'object'
     or jsonb_typeof(item->'breakdown') is distinct from 'object'
     or jsonb_typeof(item->'batting_points') is distinct from 'number'
     or jsonb_typeof(item->'bowling_points') is distinct from 'number'
     or jsonb_typeof(item->'fielding_points') is distinct from 'number'
     or jsonb_typeof(item->'bonus_points') is distinct from 'number';
  if v_invalid_count > 0 then
    raise exception 'Artifact contains % invalid player score rows', v_invalid_count;
  end if;

  select count(*) - count(distinct item->>'player_id') into v_duplicate_count
  from jsonb_array_elements(v_payload) item;
  if v_duplicate_count > 0 then raise exception 'Artifact contains duplicate player score rows'; end if;

  v_player_count := jsonb_array_length(v_payload);
  if jsonb_typeof(v_reconciliation->'playerCount') is distinct from 'number'
     or jsonb_typeof(v_reconciliation->'expectedPlayerCount') is distinct from 'number'
     or jsonb_typeof(v_reconciliation->'battingPoints') is distinct from 'number'
     or jsonb_typeof(v_reconciliation->'bowlingPoints') is distinct from 'number'
     or jsonb_typeof(v_reconciliation->'fieldingPoints') is distinct from 'number'
     or jsonb_typeof(v_reconciliation->'bonusPoints') is distinct from 'number'
     or jsonb_typeof(v_reconciliation->'totalPoints') is distinct from 'number' then
    raise exception 'Artifact reconciliation fields must be numeric';
  end if;
  v_expected_player_count := (v_reconciliation->>'expectedPlayerCount')::integer;
  if (v_reconciliation->>'playerCount')::integer <> v_player_count
     or v_expected_player_count < 1
     or v_expected_player_count > v_player_count then
    raise exception 'Artifact player reconciliation does not match its staging payload';
  end if;

  select
    coalesce(sum((item->>'batting_points')::numeric), 0),
    coalesce(sum((item->>'bowling_points')::numeric), 0),
    coalesce(sum((item->>'fielding_points')::numeric), 0),
    coalesce(sum((item->>'bonus_points')::numeric), 0)
  into v_batting, v_bowling, v_fielding, v_bonus
  from jsonb_array_elements(v_payload) item;
  v_total := v_batting + v_bowling + v_fielding + v_bonus;

  if (v_reconciliation->>'battingPoints')::numeric <> v_batting
     or (v_reconciliation->>'bowlingPoints')::numeric <> v_bowling
     or (v_reconciliation->>'fieldingPoints')::numeric <> v_fielding
     or (v_reconciliation->>'bonusPoints')::numeric <> v_bonus
     or (v_reconciliation->>'totalPoints')::numeric <> v_total then
    raise exception 'Artifact category totals do not reconcile with its player rows';
  end if;

  select * into v_existing
  from public.score_ingestion_batches
  where fixture_id = p_fixture_id and source_fingerprint = v_fingerprint;
  if found then
    v_canonical_existing := (v_existing.review_artifact - 'generatedAt') #- '{source,retrievedAt}';
    v_canonical_incoming := (p_artifact - 'generatedAt') #- '{source,retrievedAt}';
    if v_canonical_existing <> v_canonical_incoming then
      raise exception 'The source fingerprint already exists with different score facts';
    end if;
    return jsonb_build_object(
      'batch_id', v_existing.id,
      'calculation_version', v_existing.calculation_version,
      'player_count', (v_existing.reconciliation->>'playerCount')::integer,
      'warning_count', v_existing.warning_count,
      'status', v_existing.status,
      'idempotent', true
    );
  end if;

  update public.score_ingestion_batches
  set status = 'superseded', updated_at = now()
  where fixture_id = p_fixture_id and status = 'staged';

  v_stage_result := public.stage_match_player_points(p_fixture_id, v_payload);

  insert into public.score_ingestion_batches (
    league_id, fixture_id, source_provider, external_match_id, source_url,
    source_fingerprint, artifact_schema_version, rule_set_id, review_artifact,
    reconciliation, warning_count, review_notes, status, calculation_version,
    created_by
  ) values (
    v_fixture.league_id, p_fixture_id, v_source->>'provider',
    v_source->>'externalMatchId', v_source->>'sourceUrl', v_fingerprint, 1,
    v_rule_set_id, p_artifact, v_reconciliation, v_warning_count,
    nullif(btrim(coalesce(p_review_notes, '')), ''), 'staged',
    (v_stage_result->>'calculation_version')::integer, auth.uid()
  )
  returning id into v_batch_id;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    v_fixture.league_id, auth.uid(), 'score_ingestion_batch_staged',
    'score_ingestion_batch', v_batch_id::text,
    jsonb_build_object(
      'fixture_id', p_fixture_id,
      'match_number', v_fixture.match_number,
      'source_fingerprint', v_fingerprint,
      'calculation_version', (v_stage_result->>'calculation_version')::integer,
      'player_count', v_player_count,
      'warning_count', v_warning_count
    )
  );

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'calculation_version', (v_stage_result->>'calculation_version')::integer,
    'player_count', v_player_count,
    'warning_count', v_warning_count,
    'status', 'staged',
    'idempotent', false
  );
end;
$$;

-- Keep the low-level payload writer internal. Browser clients can only enter
-- review through the validated, source-audited batch RPC above.
revoke all on function public.stage_match_player_points(uuid, jsonb)
  from public, authenticated, anon;
revoke all on function public.stage_score_ingestion_batch(uuid, jsonb, text)
  from public, anon;
grant execute on function public.stage_score_ingestion_batch(uuid, jsonb, text)
  to authenticated;

create or replace function public.publish_match_scores_safe(p_fixture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_calculation_version integer;
  v_missing integer;
  v_result jsonb;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_admin(v_fixture.league_id) then raise exception 'League admin access required'; end if;
  select max(calculation_version) into v_calculation_version from public.player_match_points where fixture_id = p_fixture_id;
  select count(*) into v_missing
  from public.lineup_submissions lineup
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  where lineup.fixture_id = p_fixture_id
    and lineup.status in ('submitted', 'locked')
    and not exists (
      select 1 from public.player_match_points points
      where points.fixture_id = p_fixture_id
        and points.player_id = lineup_player.player_id
        and points.calculation_version = v_calculation_version
    );
  if v_missing > 0 then raise exception 'Cannot publish: % selected player score rows are missing', v_missing; end if;
  if not exists (select 1 from public.lineup_submissions where fixture_id = p_fixture_id and status in ('submitted', 'locked')) then
    raise exception 'Cannot publish a match with no submitted lineups';
  end if;

  v_result := public.publish_match_scores(p_fixture_id);

  update public.score_ingestion_batches
  set status = case when calculation_version = v_calculation_version then 'published' else 'superseded' end,
      published_at = case when calculation_version = v_calculation_version then now() else published_at end,
      updated_at = now()
  where fixture_id = p_fixture_id and status in ('staged', 'published');

  return v_result;
end;
$$;

commit;
