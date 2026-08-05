-- Stages the verified Match 1 player breakdown for admin review.
-- Non-participating players selected in the test XIs receive explicit zero points.
begin;

do $$
declare
  v_admin_user_id uuid;
begin
  select user_id into v_admin_user_id
  from public.league_members
  where league_id = '10000000-0000-4000-8000-000000002026'
    and role = 'league_admin' and status = 'active' and user_id is not null
  order by display_name
  limit 1;
  if v_admin_user_id is null then
    raise exception 'No authenticated league-admin account is linked. Sign in to the app once as Pandiyan or Saravana, then retry.';
  end if;
  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
end;
$$;

with fixture as (
  select id from public.fixtures
  where league_id = '10000000-0000-4000-8000-000000002026' and match_number = 1
), verified(name, batting, bowling, fielding, bonus) as (
  values
    ('Travis Head',13,0,0,0), ('Abhishek Sharma',9,0,0,0),
    ('Ishan Kishan',124,0,0,0), ('Nitish Kumar Reddy',1,6,0,0),
    ('Heinrich Klaasen',41,0,20,0), ('Salil Arora',11,0,0,0),
    ('Aniket Verma',78,0,0,0), ('Harsh Dubey',3,24,10,0),
    ('Harshal Patel',0,-8,0,0), ('David Payne',6,48,0,0),
    ('Jaydev Unadkat',4,30,10,0), ('Eshan Malinga',0,-8,0,0),
    ('Phil Salt',10,0,30,2), ('Virat Kohli',104,0,10,2),
    ('Devdutt Padikkal',104,0,30,2), ('Rajat Patidar',63,0,0,2),
    ('Jitesh Sharma',-4,0,10,2), ('Tim David',27,0,0,2),
    ('Jacob Duffy',0,96,0,17), ('Bhuvneshwar Kumar',0,33,0,2),
    ('Abhinandan Singh',0,26,10,2), ('Romario Shepherd',0,68,0,2),
    ('Suyash Sharma',0,30,0,2), ('Krunal Pandya',0,-8,0,2)
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
    and league_player.league_id = '10000000-0000-4000-8000-000000002026' and league_player.active
), payload as (
  select jsonb_agg(jsonb_build_object(
    'player_id', player.id,
    'raw_stats', jsonb_build_object(
      'source', case when verified.name is null then 'not_in_match' else 'verified_match_1' end,
      'player_name', player.full_name
    ),
    'breakdown', jsonb_build_object('source', 'verified_match_1_breakdown'),
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
