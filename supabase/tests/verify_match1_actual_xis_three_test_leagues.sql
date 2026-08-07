-- Verifies the Match 1 staging performed by
-- `stage_match1_actual_xis_three_test_leagues.sql`.

with expected_owners(email) as (
  values
    ('baluinfo@gmail.com'),
    ('jebarajsam@gmail.com'),
    ('johnyamarnath@gmail.com'),
    ('osa.mansurahamad@gmail.com'),
    ('muralikg24@gmail.com'),
    ('pandiyan.mayathevar@gmail.com'),
    ('saransamy@gmail.com'),
    ('sashi511@gmail.com'),
    ('tamilkrishna.info@gmail.com')
), staged as (
  select
    league.slug,
    member.email,
    lineup.id as lineup_id,
    lineup.status,
    lineup.captain_player_id,
    lineup.vice_captain_player_id,
    lineup.impact_player_id,
    count(lineup_player.player_id) as selected_players,
    coalesce(max(booster.code), '-') as booster
  from public.leagues league
  join public.fixtures fixture
    on fixture.league_id = league.id and fixture.match_number = 1
  join public.league_members member on member.league_id = league.id
  join expected_owners expected on lower(expected.email) = lower(member.email)
  left join public.lineup_submissions lineup
    on lineup.fixture_id = fixture.id and lineup.member_id = member.id
  left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  left join public.lineup_boosters lineup_booster on lineup_booster.lineup_id = lineup.id
  left join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
  where league.slug in (
    'ipl-2026-open-test',
    'ipl-2026-unique-test',
    'ipl-2026-royalty-test'
  )
  group by
    league.slug,
    member.email,
    lineup.id,
    lineup.status,
    lineup.captain_player_id,
    lineup.vice_captain_player_id,
    lineup.impact_player_id
)
select
  slug,
  email,
  selected_players,
  booster,
  case
    when lineup_id is null then 'FAIL: MISSING LINEUP'
    when status <> 'submitted' then 'FAIL: NOT SUBMITTED'
    when selected_players <> 11 then 'FAIL: PLAYER COUNT'
    when captain_player_id is null then 'FAIL: CAPTAIN'
    when vice_captain_player_id is null then 'FAIL: VICE CAPTAIN'
    when impact_player_id is null then 'FAIL: IMPACT'
    when lower(email) = 'jebarajsam@gmail.com' and booster <> '2UP'
      then 'FAIL: JEBA 2UP'
    when lower(email) <> 'jebarajsam@gmail.com' and booster <> '-'
      then 'FAIL: UNEXPECTED BOOSTER'
    else 'PASS'
  end as status
from staged
order by slug, lower(email);
