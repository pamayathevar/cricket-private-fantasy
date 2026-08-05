-- Stages verified IPL 2026 Matches 3, 4 and 5 as one atomic batch.
-- Sources: ESPNcricinfo match ids 1527676, 1527677 and 1527678.
-- This script does not publish. All three fixtures move to REVIEW or none do.
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
  if (select count(*) from public.fixtures where league_id = '10000000-0000-4000-8000-000000002026' and match_number between 3 and 5) <> 3 then
    raise exception 'Expected exactly three fixtures for Matches 3-5.';
  end if;
end;
$$;

with verified(match_number, name, batting, bowling, fielding, bonus) as (
  values
    (3,'Sanju Samson',7,0,0,0),(3,'Ruturaj Gaikwad',3,0,0,0),(3,'Ayush Mhatre',-4,0,0,0),
    (3,'Matthew Short',2,0,0,0),(3,'Sarfaraz Khan',25,0,10,0),(3,'Kartik Sharma',22,0,0,0),
    (3,'Shivam Dube',8,0,0,0),(3,'Jamie Overton',53,-10,0,0),(3,'Noor Ahmad',1,-2,0,0),
    (3,'Matt Henry',6,-6,0,0),(3,'Anshul Kamboj',4,56,0,0),(3,'Yashasvi Jaiswal',47,0,10,2),
    (3,'Vaibhav Sooryavanshi',104,0,0,2),(3,'Dhruv Jurel',22,0,28,2),(3,'Riyan Parag',21,0,0,2),
    (3,'Jofra Archer',0,79,0,2),(3,'Nandre Burger',0,72,0,17),(3,'Brijesh Sharma',0,44,0,2),
    (3,'Sandeep Sharma',0,24,0,2),(3,'Ravi Bishnoi',0,35,20,2),(3,'Ravindra Jadeja',0,66,0,2),
    (3,'Khaleel Ahmed',0,22,0,0),(3,'Shimron Hetmyer',0,0,8,2),

    (4,'Sai Sudharsan',17,0,0,0),(4,'Shubman Gill',51,0,20,0),(4,'Jos Buttler',49,0,10,0),
    (4,'Glenn Phillips',34,0,0,0),(4,'Washington Sundar',22,30,10,0),(4,'M Shahrukh Khan',4,0,0,0),
    (4,'Rahul Tewatia',14,0,0,0),(4,'Rashid Khan',0,40,10,0),(4,'Priyansh Arya',9,0,0,2),
    (4,'Prabhsimran Singh',56,0,0,2),(4,'Cooper Connolly',101,0,10,17),(4,'Shreyas Iyer',30,0,10,2),
    (4,'Nehal Wadhera',3,0,0,2),(4,'Shashank Singh',4,0,0,2),(4,'Marcus Stoinis',-2,0,0,2),
    (4,'Marco Jansen',11,40,10,2),(4,'Xavier Bartlett',13,12,10,2),(4,'Arshdeep Singh',0,10,20,2),
    (4,'Vijaykumar Vyshak',0,80,0,2),(4,'Yuzvendra Chahal',0,60,0,2),(4,'Mohammed Siraj',0,10,0,0),
    (4,'Kagiso Rabada',0,30,0,0),(4,'Ashok Sharma',0,32,10,0),(4,'Prasidh Krishna',0,88,10,0),

    (5,'Mitchell Marsh',49,0,0,0),(5,'Rishabh Pant',8,0,10,0),(5,'Aiden Markram',14,-4,0,0),
    (5,'Ayush Badoni',-2,0,0,0),(5,'Nicholas Pooran',9,0,0,0),(5,'Abdul Samad',47,0,10,0),
    (5,'Mukul Choudhary',20,0,0,0),(5,'Shahbaz Ahmed',16,-12,0,0),(5,'Mohammed Shami',1,44,0,0),
    (5,'Anrich Nortje',0,8,0,0),(5,'Mohsin Khan',0,68,10,0),(5,'KL Rahul',-4,0,10,2),
    (5,'Pathum Nissanka',1,0,0,2),(5,'Nitish Rana',17,0,0,2),(5,'Sameer Rizvi',93,0,0,17),
    (5,'Axar Patel',-4,42,0,2),(5,'Tristan Stubbs',48,0,20,2),(5,'Mukesh Kumar',0,24,10,2),
    (5,'Lungi Ngidi',0,74,0,2),(5,'T Natarajan',0,77,0,2),(5,'Kuldeep Yadav',0,58,20,2),
    (5,'Vipraj Nigam',0,2,0,2),(5,'Prince Yadav',0,64,0,0),(5,'David Miller',0,0,10,0)
), fixtures as (
  select id, match_number
  from public.fixtures
  where league_id = '10000000-0000-4000-8000-000000002026' and match_number between 3 and 5
), resolved as (
  select verified.*, player.id player_id
  from verified
  join public.players player on player.full_name = verified.name
  join public.league_players league_player on league_player.player_id = player.id
    and league_player.league_id = '10000000-0000-4000-8000-000000002026' and league_player.active
), mapping_guard as (
  -- Deliberately stops the batch if any scorecard name does not resolve exactly once.
  select 1 / case when (select count(*) from resolved) = (select count(*) from verified) then 1 else 0 end ok
), required_players as (
  select fixture.id fixture_id, fixture.match_number, lineup_player.player_id
  from fixtures fixture
  join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  union
  select fixture.id, fixture.match_number, resolved.player_id
  from fixtures fixture join resolved on resolved.match_number = fixture.match_number
), payloads as (
  select required.fixture_id, required.match_number,
    jsonb_agg(jsonb_build_object(
      'player_id', player.id,
      'raw_stats', jsonb_build_object(
        'source', case when resolved.name is null then 'not_in_match' else 'espncricinfo_' || case required.match_number when 3 then '1527676' when 4 then '1527677' else '1527678' end end,
        'scorecard_url', case required.match_number
          when 3 then 'https://www.cricinfo.com/series/ipl-2026-1510719/rajasthan-royals-vs-chennai-super-kings-3rd-match-1527676/full-scorecard'
          when 4 then 'https://www.cricinfo.com/series/ipl-2026-1510719/punjab-kings-vs-gujarat-titans-4th-match-1527677/full-scorecard'
          else 'https://www.cricinfo.com/series/ipl-2026-1510719/delhi-capitals-vs-lucknow-super-giants-5th-match-1527678/full-scorecard' end,
        'player_name', player.full_name,
        'summary', case when resolved.name is null then 'Selected player did not participate' else 'Verified scorecard calculation' end
      ),
      'breakdown', jsonb_build_object(
        'batting', coalesce(resolved.batting,0),'bowling',coalesce(resolved.bowling,0),
        'fielding',coalesce(resolved.fielding,0),'bonus',coalesce(resolved.bonus,0),
        'detail',case when resolved.name is null then 'Not in match' else 'Verified scorecard calculation' end
      ),
      'batting_points',coalesce(resolved.batting,0),'bowling_points',coalesce(resolved.bowling,0),
      'fielding_points',coalesce(resolved.fielding,0),'bonus_points',coalesce(resolved.bonus,0)
    ) order by player.full_name) points
  from required_players required
  cross join mapping_guard guard
  join public.players player on player.id = required.player_id
  left join resolved on resolved.match_number = required.match_number and resolved.player_id = required.player_id
  where guard.ok = 1
  group by required.fixture_id, required.match_number
), staged as (
  select match_number, public.stage_match_player_points(fixture_id, points) result
  from payloads
)
select match_number, result from staged order by match_number;

commit;
