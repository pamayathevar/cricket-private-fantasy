begin;

-- Rollout: extend the existing fixture-identity guard with the IPL playoff labels
-- used by both supported score providers. Existing league-stage matching is unchanged.
-- Rollback: reapply the function definition from 20260820134700_scorecard_series_sources.sql.
-- No table data or user-owned scorecard mapping is modified by this migration.
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
  v_numeric_match_label text;
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
  v_numeric_match_label := nullif(
    substring(v_path from '([0-9]+)(st|nd|rd|th)-match'),
    ''
  );
  v_source_match_number := case
    when v_numeric_match_label is not null then v_numeric_match_label::integer
    when v_path ~ '(^|[-_/])qualifier-1([-_/]|$)' then 71
    when v_path ~ '(^|[-_/])eliminator([-_/]|$)' then 72
    when v_path ~ '(^|[-_/])qualifier-2([-_/]|$)' then 73
    when v_path ~ '(^|[-_/])final([-_/]|$)' then 74
    else null
  end;
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

commit;
