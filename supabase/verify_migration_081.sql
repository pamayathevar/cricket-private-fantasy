-- Read-only verification for 20260820141310_playoff_scorecard_series_discovery.sql.
do $$
declare
  v_fixture_id uuid;
  v_case record;
begin
  for v_case in
    select * from (values
      (71, 'RCB', 'GT', 'https://www.espncricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-vs-gujarat-titans-qualifier-1-1527744/full-scorecard'),
      (72, 'SRH', 'RR', 'https://www.espncricinfo.com/series/ipl-2026-1510719/rajasthan-royals-vs-sunrisers-hyderabad-eliminator-1527745/full-scorecard'),
      (73, 'GT', 'RR', 'https://www.cricbuzz.com/live-cricket-scorecard/149731/rr-vs-gt-qualifier-2-indian-premier-league-2026'),
      (74, 'RCB', 'GT', 'https://www.cricbuzz.com/live-cricket-scorecard/149738/gt-vs-rcb-final-indian-premier-league-2026')
    ) as cases(match_number, home_code, away_code, scorecard_url)
  loop
    select fixture.id
    into v_fixture_id
    from public.fixtures fixture
    join public.cricket_teams home on home.id = fixture.home_team_id
    join public.cricket_teams away on away.id = fixture.away_team_id
    where fixture.match_number = v_case.match_number
      and home.code = v_case.home_code
      and away.code = v_case.away_code
    limit 1;

    if v_fixture_id is null then
      raise exception 'Fixture % (% vs %) is missing', v_case.match_number, v_case.home_code, v_case.away_code;
    end if;
    if not public.scorecard_url_matches_fixture_identity(v_fixture_id, v_case.scorecard_url) then
      raise exception 'Playoff scorecard URL was rejected for Match %', v_case.match_number;
    end if;
  end loop;

  select fixture.id
  into v_fixture_id
  from public.fixtures fixture
  join public.cricket_teams home on home.id = fixture.home_team_id
  join public.cricket_teams away on away.id = fixture.away_team_id
  where fixture.match_number = 71 and home.code = 'RCB' and away.code = 'GT'
  limit 1;

  if public.scorecard_url_matches_fixture_identity(
    v_fixture_id,
    'https://www.espncricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-vs-gujarat-titans-eliminator-1527744/full-scorecard'
  ) then
    raise exception 'Match 71 accepted the Eliminator label';
  end if;
  if public.scorecard_url_matches_fixture_identity(
    v_fixture_id,
    'https://www.cricbuzz.com/live-cricket-scorecard/149738/rr-vs-srh-qualifier-1-indian-premier-league-2026'
  ) then
    raise exception 'Match 71 accepted the wrong team pair';
  end if;

  if has_function_privilege('anon', 'public.scorecard_url_matches_fixture_identity(uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.scorecard_url_matches_fixture_identity(uuid,text)', 'EXECUTE') then
    raise exception 'Internal fixture-identity helper is directly executable by app roles';
  end if;
end;
$$;
