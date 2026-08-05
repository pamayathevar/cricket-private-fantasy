-- Stages verified IPL 2026 Match 2 points for admin review. Does not publish.
-- ESPNcricinfo match 1527675: KKR 220/4; MI 224/4. MI won by 6 wickets.
begin;

do $$
declare v_admin_user_id uuid;
begin
  select user_id into v_admin_user_id
  from public.league_members
  where league_id = '10000000-0000-4000-8000-000000002026'
    and role = 'league_admin' and status = 'active' and user_id is not null
  order by display_name limit 1;
  if v_admin_user_id is null then
    raise exception 'No authenticated league-admin account is linked.';
  end if;
  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
end;
$$;

with fixture as (
  select id from public.fixtures
  where league_id = '10000000-0000-4000-8000-000000002026' and match_number = 2
), verified(name, batting, bowling, fielding, bonus, detail) as (
  values
    ('Ajinkya Rahane',94,0,0,0,'67 runs, 3 fours, 5 sixes, 50 milestone, SR 167.50'),
    ('Finn Allen',63,0,0,0,'37 runs, 6 fours, 2 sixes, 25 milestone, SR 217.65'),
    ('Cameron Green',35,0,0,0,'18 runs, 1 four, 1 six, SR 180.00'),
    ('Angkrish Raghuvanshi',81,0,0,0,'51 runs, 6 fours, 2 sixes, 50 milestone, SR 175.86'),
    ('Rinku Singh',47,0,10,0,'33 runs, 4 fours, 25 milestone, SR 157.14; 1 catch'),
    ('Ramandeep Singh',4,0,0,0,'4 not out'),
    ('Anukul Roy',0,-6,20,0,'1.1 overs, 15 runs, 0 wickets, 1 dot; 1 catch, 1 run-out'),
    ('Sunil Narine',0,28,0,0,'3 overs, 30 runs, 1 non-bowler wicket, 6 dots'),
    ('Varun Chakravarthy',0,-2,0,0,'4 overs, 48 runs, 0 wickets, 5 dots'),
    ('Vaibhav Arora',0,26,0,0,'4 overs, 52 runs, 1 non-bowler wicket, 7 dots'),
    ('Blessing Muzarabani',0,6,0,0,'3 overs, 34 runs, 0 wickets, 6 dots'),
    ('Kartik Tyagi',0,32,0,0,'4 overs, 43 runs, 1 non-bowler wicket, 8 dots'),
    ('Manish Pandey',0,0,10,0,'Substitute fielder catch'),
    ('Ryan Rickelton',127,0,0,2,'81 runs, 4 fours, 8 sixes, 75 milestone, SR 188.37; winning XI'),
    ('Rohit Sharma',122,0,0,2,'78 runs, 6 fours, 6 sixes, 75 milestone, SR 205.26; winning XI'),
    ('Suryakumar Yadav',19,0,0,2,'16 runs, 3 fours; winning XI'),
    ('Tilak Varma',28,0,20,2,'20 runs, 4 fours, SR 142.86; 2 catches; winning XI'),
    ('Hardik Pandya',29,24,10,2,'18 not out, 3 fours, SR 163.64; 1 non-bowler wicket, 6 dots; 1 catch; winning XI'),
    ('Naman Dhir',6,0,0,2,'5 not out, 1 four; winning XI'),
    ('Sherfane Rutherford',0,0,10,2,'1 catch; winning XI'),
    ('Shardul Thakur',0,73,0,17,'3 wickets (2 non-bowler, 1 bowler), 7 dots, wicket milestone; Player of Match and winning XI'),
    ('Mayank Markande',0,-10,0,2,'1 over, 16 runs, 0 wickets, 1 dot; winning XI'),
    ('AM Ghazanfar',0,-2,0,2,'4 overs, 51 runs, 0 wickets, 5 dots; winning XI'),
    ('Trent Boult',0,8,0,2,'4 overs, 38 runs, 0 wickets, 7 dots; winning XI'),
    ('Jasprit Bumrah',0,2,0,2,'4 overs, 35 runs, 0 wickets, 4 dots; winning XI')
), required_players as (
  select distinct lineup_player.player_id
  from fixture
  join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  union
  select player.id
  from verified
  join public.players player on player.full_name = verified.name
  join public.league_players league_player on league_player.player_id = player.id
    and league_player.league_id = '10000000-0000-4000-8000-000000002026'
    and league_player.active
), payload as (
  select jsonb_agg(jsonb_build_object(
    'player_id', player.id,
    'raw_stats', jsonb_build_object(
      'source', case when verified.name is null then 'not_in_match' else 'espncricinfo_1527675' end,
      'scorecard_url', 'https://www.cricinfo.com/series/ipl-2026-1510719/mumbai-indians-vs-kolkata-knight-riders-2nd-match-1527675/full-scorecard',
      'player_name', player.full_name,
      'summary', coalesce(verified.detail, 'Selected test player did not participate')
    ),
    'breakdown', jsonb_build_object(
      'batting', coalesce(verified.batting, 0),
      'bowling', coalesce(verified.bowling, 0),
      'fielding', coalesce(verified.fielding, 0),
      'bonus', coalesce(verified.bonus, 0),
      'detail', coalesce(verified.detail, 'Not in match')
    ),
    'batting_points', coalesce(verified.batting, 0),
    'bowling_points', coalesce(verified.bowling, 0),
    'fielding_points', coalesce(verified.fielding, 0),
    'bonus_points', coalesce(verified.bonus, 0)
  ) order by player.full_name) points
  from required_players
  join public.players player on player.id = required_players.player_id
  left join verified on verified.name = player.full_name
)
select public.stage_match_player_points(fixture.id, payload.points) as staged_result
from fixture cross join payload;

commit;
