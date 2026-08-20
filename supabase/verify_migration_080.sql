-- Verify one-time series URL configuration and fixture scorecard mappings.
-- Read-only. Roll back with a reviewed forward migration; export configured
-- fixture URLs before removing these columns after administrators start using them.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leagues' and column_name = 'cricinfo_series_url'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leagues' and column_name = 'cricbuzz_series_url'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'fixtures' and column_name = 'cricbuzz_scorecard_url'
  ) then
    raise exception 'Scorecard series source columns are incomplete';
  end if;

  if to_regprocedure('public.scorecard_url_matches_fixture_identity(uuid,text)') is null
     or to_regprocedure('public.configure_scorecard_series_sources(uuid,text,text,jsonb)') is null then
    raise exception 'Scorecard series source functions are incomplete';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.configure_scorecard_series_sources(uuid,text,text,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.configure_scorecard_series_sources(uuid,text,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Series source RPC execute privileges are incorrect';
  end if;

  if not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'leagues' and relation.relrowsecurity
  ) or not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public' and relation.relname = 'fixtures' and relation.relrowsecurity
  ) then
    raise exception 'RLS must remain enabled for leagues and fixtures';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'leagues' and policyname = 'leagues_admin_update'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fixtures' and policyname = 'fixtures_admin_all'
  ) then
    raise exception 'Admin write policies are missing';
  end if;

  if exists (
    select 1 from public.leagues
    where cricinfo_series_url is not null
      and cricinfo_series_url !~* '^https://([^/]+\.)?(espncricinfo\.com|cricinfo\.com)/series/'
  ) or exists (
    select 1 from public.leagues
    where cricbuzz_series_url is not null
      and cricbuzz_series_url !~* '^https://([^/]+\.)?cricbuzz\.com/cricket-series/'
  ) then
    raise exception 'A configured series URL uses an unsupported host';
  end if;

  if exists (
    select 1 from public.fixtures fixture
    where fixture.scorecard_source_url is not null
      -- Legacy fixture imports use espn.com numeric scorecard URLs. Series
      -- discovery replaces those with identity-rich ESPNcricinfo URLs as each
      -- mapping becomes available, so only validate the new URL shape here.
      and fixture.scorecard_source_url ~* '^https://([^/]+\.)?(espncricinfo\.com|cricinfo\.com)/'
      and not public.scorecard_url_matches_fixture_identity(fixture.id, fixture.scorecard_source_url)
  ) or exists (
    select 1 from public.fixtures fixture
    where fixture.cricbuzz_scorecard_url is not null
      and not public.scorecard_url_matches_fixture_identity(fixture.id, fixture.cricbuzz_scorecard_url)
  ) then
    raise exception 'A configured scorecard URL does not match its fixture identity';
  end if;
end;
$$;
