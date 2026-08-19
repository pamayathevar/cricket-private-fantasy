-- Reject staged or published score artifacts whose source URL belongs to a
-- different fixture. This is enforced in the database so the guard cannot be
-- bypassed by calling the RPCs directly.
begin;

create or replace function public.score_source_matches_fixture(
  p_fixture_id uuid,
  p_source_url text,
  p_external_match_id text
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_home_code text;
  v_home_name text;
  v_away_code text;
  v_away_name text;
  v_home_slug text;
  v_away_slug text;
  v_url_path text;
  v_canonical_external_id text;
  v_source_match_number integer;
  v_home_present boolean;
  v_away_present boolean;
  v_has_team_pair boolean;
begin
  if coalesce(p_source_url, '') !~* '^https://' or btrim(coalesce(p_external_match_id, '')) = '' then
    return false;
  end if;

  select * into v_fixture
  from public.fixtures fixture
  where fixture.id = p_fixture_id;

  if not found then return false; end if;

  select home.code, home.name, away.code, away.name
  into v_home_code, v_home_name, v_away_code, v_away_name
  from public.cricket_teams home
  join public.cricket_teams away on away.id = v_fixture.away_team_id
  where home.id = v_fixture.home_team_id;

  v_url_path := lower(regexp_replace(
    regexp_replace(p_source_url, '^https?://[^/]+', '', 'i'),
    '[?#].*$',
    ''
  ));
  if position(lower(btrim(p_external_match_id)) in v_url_path) = 0 then return false; end if;

  v_source_match_number := nullif(
    substring(v_url_path from '([0-9]+)(st|nd|rd|th)-match'),
    ''
  )::integer;
  v_home_slug := trim(both '-' from regexp_replace(lower(v_home_name), '[^a-z0-9]+', '-', 'g'));
  v_away_slug := trim(both '-' from regexp_replace(lower(v_away_name), '[^a-z0-9]+', '-', 'g'));
  v_home_present := position(v_home_slug in v_url_path) > 0
    or v_url_path ~ ('(^|[-_/])' || lower(v_home_code) || '([-_/]|$)');
  v_away_present := position(v_away_slug in v_url_path) > 0
    or v_url_path ~ ('(^|[-_/])' || lower(v_away_code) || '([-_/]|$)');
  v_has_team_pair := v_url_path ~ '(^|[-_/])(vs|v)([-_/]|$)';

  select extracted.parts[1]
  into v_canonical_external_id
  from regexp_matches(
    coalesce(v_fixture.scorecard_source_url, ''),
    '/([0-9]{5,})(/|$)',
    'g'
  ) with ordinality as extracted(parts, sequence)
  order by extracted.sequence desc
  limit 1;

  if v_canonical_external_id is not null then
    if btrim(p_external_match_id) is distinct from v_canonical_external_id then return false; end if;
    if v_source_match_number is not null and v_source_match_number <> v_fixture.match_number then return false; end if;
    if v_has_team_pair and not (v_home_present and v_away_present) then return false; end if;
    return true;
  end if;

  return v_source_match_number = v_fixture.match_number
    and v_home_present
    and v_away_present;
end;
$$;

revoke all on function public.score_source_matches_fixture(uuid, text, text)
  from public, anon, authenticated;

do $patch$
declare
  v_definition text;
  v_search text;
  v_replacement text;
begin
  select pg_get_functiondef('public.stage_score_ingestion_batch(uuid,jsonb,text)'::regprocedure)
  into v_definition;

  v_search := $search$  v_source := p_artifact->'source';
  if jsonb_typeof(v_source) is distinct from 'object'
     or btrim(coalesce(v_source->>'provider', '')) = ''
     or btrim(coalesce(v_source->>'externalMatchId', '')) = ''
     or coalesce(v_source->>'sourceUrl', '') !~ '^https://' then
    raise exception 'Artifact source requires provider, external match ID, and an HTTPS URL';
  end if;
$search$;
  v_replacement := v_search || $guard$
  if not public.score_source_matches_fixture(
    p_fixture_id,
    v_source->>'sourceUrl',
    v_source->>'externalMatchId'
  ) then
    raise exception 'Scorecard URL does not match Match %. Use the scorecard for the selected fixture before staging.', v_fixture.match_number;
  end if;
$guard$;

  if position(v_search in v_definition) = 0 then
    raise exception 'Could not install the scorecard fixture guard in stage_score_ingestion_batch';
  end if;
  execute replace(v_definition, v_search, v_replacement);

  select pg_get_functiondef('public.publish_match_scores_safe(uuid)'::regprocedure)
  into v_definition;

  v_search := $search$  v_result jsonb;
begin
$search$;
  v_replacement := $replacement$  v_result jsonb;
  v_batch public.score_ingestion_batches%rowtype;
begin
$replacement$;
  if position(v_search in v_definition) = 0 then
    raise exception 'Could not add the score-ingestion batch variable to publish_match_scores_safe';
  end if;
  v_definition := replace(v_definition, v_search, v_replacement);

  v_search := $search$  select max(calculation_version) into v_calculation_version from public.player_match_points where fixture_id = p_fixture_id;
$search$;
  v_replacement := v_search || $guard$  if v_calculation_version is null then
    raise exception 'Cannot publish: no staged player scores were found';
  end if;

  select * into v_batch
  from public.score_ingestion_batches
  where fixture_id = p_fixture_id
    and calculation_version = v_calculation_version
    and status in ('staged', 'published')
  order by case status when 'staged' then 0 else 1 end, created_at desc
  limit 1;

  if not found then
    raise exception 'Cannot publish: the staged score-ingestion review was not found';
  end if;
  if v_batch.source_url is distinct from v_batch.review_artifact #>> '{source,sourceUrl}'
     or v_batch.external_match_id is distinct from v_batch.review_artifact #>> '{source,externalMatchId}' then
    raise exception 'Cannot publish: the saved scorecard source does not match its reviewed artifact';
  end if;
  if not public.score_source_matches_fixture(
    p_fixture_id,
    v_batch.source_url,
    v_batch.external_match_id
  ) then
    raise exception 'Cannot publish Match %: the scorecard URL belongs to a different fixture', v_fixture.match_number;
  end if;
$guard$;
  if position(v_search in v_definition) = 0 then
    raise exception 'Could not install the scorecard fixture guard in publish_match_scores_safe';
  end if;
  execute replace(v_definition, v_search, v_replacement);
end;
$patch$;

revoke all on function public.stage_score_ingestion_batch(uuid, jsonb, text)
  from public, anon;
grant execute on function public.stage_score_ingestion_batch(uuid, jsonb, text)
  to authenticated;

revoke all on function public.publish_match_scores_safe(uuid)
  from public, anon;
grant execute on function public.publish_match_scores_safe(uuid)
  to authenticated;

commit;
