begin;

alter table public.leagues
  add column cricinfo_series_url text,
  add column cricbuzz_series_url text;

alter table public.fixtures
  add column cricbuzz_scorecard_url text;

comment on column public.leagues.cricinfo_series_url is
  'Administrator-configured ESPNcricinfo series schedule URL used by the browser extension to discover fixture scorecards.';
comment on column public.leagues.cricbuzz_series_url is
  'Administrator-configured Cricbuzz series matches URL used by the browser extension to discover fixture scorecards.';
comment on column public.fixtures.cricbuzz_scorecard_url is
  'Matching Cricbuzz scorecard used only to validate missing or ambiguous fielder names.';

create or replace function public.scorecard_url_matches_fixture_identity(
  p_fixture_id uuid,
  p_scorecard_url text
)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_match_number integer;
  v_home_code text;
  v_home_name text;
  v_away_code text;
  v_away_name text;
  v_path text;
  v_source_match_number integer;
  v_home_slug text;
  v_away_slug text;
begin
  if coalesce(p_scorecard_url, '') !~* '^https://([^/]+\.)?(espncricinfo\.com|cricinfo\.com|cricbuzz\.com)/' then
    return false;
  end if;

  select fixture.match_number, home.code, home.name, away.code, away.name
  into v_match_number, v_home_code, v_home_name, v_away_code, v_away_name
  from public.fixtures fixture
  join public.cricket_teams home on home.id = fixture.home_team_id
  join public.cricket_teams away on away.id = fixture.away_team_id
  where fixture.id = p_fixture_id;

  if not found then return false; end if;

  v_path := lower(regexp_replace(
    regexp_replace(p_scorecard_url, '^https?://[^/]+', '', 'i'),
    '[?#].*$',
    ''
  ));
  v_source_match_number := nullif(
    substring(v_path from '([0-9]+)(st|nd|rd|th)-match'),
    ''
  )::integer;
  v_home_slug := trim(both '-' from regexp_replace(lower(v_home_name), '[^a-z0-9]+', '-', 'g'));
  v_away_slug := trim(both '-' from regexp_replace(lower(v_away_name), '[^a-z0-9]+', '-', 'g'));

  return v_source_match_number = v_match_number
    and (
      position(v_home_slug in v_path) > 0
      or v_path ~ ('(^|[-_/])' || lower(v_home_code) || '([-_/]|$)')
    )
    and (
      position(v_away_slug in v_path) > 0
      or v_path ~ ('(^|[-_/])' || lower(v_away_code) || '([-_/]|$)')
    );
end;
$$;

revoke all on function public.scorecard_url_matches_fixture_identity(uuid, text)
  from public, anon, authenticated;

create or replace function public.configure_scorecard_series_sources(
  p_league_id uuid,
  p_cricinfo_series_url text,
  p_cricbuzz_series_url text,
  p_fixture_sources jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source jsonb;
  v_fixture_id uuid;
  v_cricinfo_url text;
  v_cricbuzz_url text;
  v_updated integer := 0;
  v_before jsonb;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'Only a league administrator can configure scorecard sources';
  end if;
  if coalesce(p_cricinfo_series_url, '') !~* '^https://([^/]+\.)?(espncricinfo\.com|cricinfo\.com)/series/' then
    raise exception 'Enter an HTTPS ESPNcricinfo series URL';
  end if;
  if coalesce(p_cricbuzz_series_url, '') !~* '^https://([^/]+\.)?cricbuzz\.com/cricket-series/' then
    raise exception 'Enter an HTTPS Cricbuzz series URL';
  end if;
  if jsonb_typeof(p_fixture_sources) is distinct from 'array' then
    raise exception 'Fixture scorecard sources must be a JSON array';
  end if;

  select jsonb_build_object(
    'cricinfoSeriesUrl', league.cricinfo_series_url,
    'cricbuzzSeriesUrl', league.cricbuzz_series_url
  ) into v_before
  from public.leagues league
  where league.id = p_league_id;

  update public.leagues
  set cricinfo_series_url = btrim(p_cricinfo_series_url),
      cricbuzz_series_url = btrim(p_cricbuzz_series_url),
      updated_at = now()
  where id = p_league_id;

  for v_source in select value from jsonb_array_elements(p_fixture_sources)
  loop
    v_fixture_id := nullif(v_source->>'fixtureId', '')::uuid;
    v_cricinfo_url := nullif(btrim(v_source->>'cricinfoUrl'), '');
    v_cricbuzz_url := nullif(btrim(v_source->>'cricbuzzUrl'), '');

    if not exists (
      select 1 from public.fixtures fixture
      where fixture.id = v_fixture_id and fixture.league_id = p_league_id
    ) then
      raise exception 'Fixture % does not belong to this league', v_fixture_id;
    end if;
    if v_cricinfo_url is not null
       and v_cricinfo_url !~* '^https://([^/]+\.)?(espncricinfo\.com|cricinfo\.com)/' then
      raise exception 'ESPNcricinfo scorecard must use an ESPNcricinfo host';
    end if;
    if v_cricbuzz_url is not null
       and v_cricbuzz_url !~* '^https://([^/]+\.)?cricbuzz\.com/' then
      raise exception 'Cricbuzz scorecard must use a Cricbuzz host';
    end if;
    if v_cricinfo_url is not null
       and not public.scorecard_url_matches_fixture_identity(v_fixture_id, v_cricinfo_url) then
      raise exception 'ESPNcricinfo scorecard does not match fixture %', v_fixture_id;
    end if;
    if v_cricbuzz_url is not null
       and not public.scorecard_url_matches_fixture_identity(v_fixture_id, v_cricbuzz_url) then
      raise exception 'Cricbuzz scorecard does not match fixture %', v_fixture_id;
    end if;

    update public.fixtures
    set scorecard_source_url = coalesce(v_cricinfo_url, scorecard_source_url),
        cricbuzz_scorecard_url = coalesce(v_cricbuzz_url, cricbuzz_scorecard_url),
        updated_at = now()
    where id = v_fixture_id;
    v_updated := v_updated + 1;
  end loop;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_league_id,
    auth.uid(),
    'scorecard_series_sources_configured',
    'league',
    p_league_id::text,
    v_before,
    jsonb_build_object(
      'cricinfoSeriesUrl', btrim(p_cricinfo_series_url),
      'cricbuzzSeriesUrl', btrim(p_cricbuzz_series_url),
      'fixtureSourceCount', v_updated,
      'fixtureSources', p_fixture_sources
    )
  );

  return jsonb_build_object('fixtureSourceCount', v_updated);
end;
$$;

revoke all on function public.configure_scorecard_series_sources(uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.configure_scorecard_series_sources(uuid, text, text, jsonb)
  to authenticated;

commit;
