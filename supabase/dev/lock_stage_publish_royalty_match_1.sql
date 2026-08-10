-- Lock, calculate, verify, and publish Match 1 for IPL 2026 [Royalty Driven].
-- Source: ESPNcricinfo IPL 2026 Match 1 full scorecard (match id 1527674).
-- This script deliberately targets only league slug: ipl-2026-royalty-test.
-- Run as one complete query in the Supabase SQL Editor.

begin;

create temporary table royalty_match_1_run_results (
  step integer primary key,
  operation text not null,
  status text not null,
  detail jsonb not null default '{}'::jsonb
) on commit drop;

do $$
declare
  v_league_id uuid;
  v_fixture_id uuid;
  v_admin_user_id uuid;
  v_existing_scoring_status text;
  v_new_start timestamptz;
begin
  select league.id
  into strict v_league_id
  from public.leagues league
  where league.slug = 'ipl-2026-royalty-test';

  select fixture.id, fixture.scoring_status,
    (
      (current_date - 1 + (fixture.scheduled_start at time zone 'America/Toronto')::time)
      at time zone 'America/Toronto'
    )
  into strict v_fixture_id, v_existing_scoring_status, v_new_start
  from public.fixtures fixture
  where fixture.league_id = v_league_id
    and fixture.match_number = 1
  for update;

  if v_existing_scoring_status in ('published', 'corrected') then
    raise exception 'Royalty Driven Match 1 is already %. This script will not republish it.',
      v_existing_scoring_status;
  end if;

  select member.user_id
  into v_admin_user_id
  from public.league_members member
  where member.league_id = v_league_id
    and member.role = 'league_admin'
    and member.status = 'active'
    and member.user_id is not null
  order by
    case when lower(member.email) = 'pandiyan.mayathevar@gmail.com' then 0 else 1 end,
    member.display_name
  limit 1;

  if v_admin_user_id is null then
    raise exception 'No authenticated league-admin account is linked to the Royalty Driven league';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);

  update public.fixtures
  set scheduled_start = v_new_start,
      lineup_lock_at = v_new_start,
      status = 'completed',
      scorecard_source_url = 'https://www.cricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-vs-sunrisers-hyderabad-1st-match-1527674/full-scorecard',
      updated_at = now()
  where id = v_fixture_id;

  insert into royalty_match_1_run_results (step, operation, status, detail)
  values (1, 'Lock Match 1', 'PASS', jsonb_build_object(
    'league_id', v_league_id,
    'fixture_id', v_fixture_id,
    'scheduled_start', v_new_start,
    'lineup_lock_at', v_new_start,
    'fixture_status', 'completed'
  ));
exception
  when no_data_found then
    raise exception 'Royalty Driven league or Match 1 was not found';
  when too_many_rows then
    raise exception 'More than one Royalty Driven league or Match 1 fixture was found';
end;
$$;

with target as (
  select league.id league_id, fixture.id fixture_id
  from public.leagues league
  join public.fixtures fixture on fixture.league_id = league.id
  where league.slug = 'ipl-2026-royalty-test'
    and fixture.match_number = 1
), verified(name, batting, bowling, fielding, bonus) as (
  values
    ('Travis Head',13,0,0,0),
    ('Abhishek Sharma',9,0,0,0),
    ('Ishan Kishan',124,0,0,0),
    ('Nitish Kumar Reddy',1,6,0,0),
    ('Heinrich Klaasen',41,0,20,0),
    ('Salil Arora',11,0,0,0),
    ('Aniket Verma',78,0,0,0),
    ('Harsh Dubey',3,24,10,0),
    ('Harshal Patel',0,-8,0,0),
    ('David Payne',6,48,0,0),
    ('Jaydev Unadkat',4,30,10,0),
    ('Eshan Malinga',0,-8,0,0),
    ('Phil Salt',10,0,30,2),
    ('Virat Kohli',104,0,10,2),
    ('Devdutt Padikkal',104,0,30,2),
    ('Rajat Patidar',63,0,0,2),
    ('Jitesh Sharma',-4,0,10,2),
    ('Tim David',27,0,0,2),
    ('Jacob Duffy',0,96,0,17),
    ('Bhuvneshwar Kumar',0,33,0,2),
    ('Abhinandan Singh',0,26,10,2),
    ('Romario Shepherd',0,68,0,2),
    ('Suyash Sharma',0,30,0,2),
    ('Krunal Pandya',0,-8,0,2)
), required_players as (
  select distinct lineup_player.player_id
  from target
  join public.lineup_submissions lineup on lineup.fixture_id = target.fixture_id
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  where lineup.status in ('submitted', 'locked')

  union

  select league_player.player_id
  from target
  join public.league_players league_player
    on league_player.league_id = target.league_id and league_player.active
  join public.players player on player.id = league_player.player_id
  join verified on verified.name = player.full_name
), payload as (
  select jsonb_agg(jsonb_build_object(
    'player_id', player.id,
    'raw_stats', jsonb_build_object(
      'source', case when verified.name is null then 'not_in_match' else 'espncricinfo_match_1527674' end,
      'player_name', player.full_name,
      'scorecard_url', 'https://www.cricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-vs-sunrisers-hyderabad-1st-match-1527674/full-scorecard'
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
), staged as (
  select public.stage_match_player_points(target.fixture_id, payload.points) result
  from target cross join payload
)
insert into royalty_match_1_run_results (step, operation, status, detail)
select 2, 'Stage verified player points', 'PASS', result
from staged;

do $$
declare
  v_fixture_id uuid;
  v_calculation_version integer;
  v_submitted_lineups integer;
  v_selected_rows integer;
  v_missing_rows integer;
begin
  select fixture.id
  into strict v_fixture_id
  from public.fixtures fixture
  join public.leagues league on league.id = fixture.league_id
  where league.slug = 'ipl-2026-royalty-test'
    and fixture.match_number = 1;

  select max(points.calculation_version)
  into v_calculation_version
  from public.player_match_points points
  where points.fixture_id = v_fixture_id;

  select count(distinct lineup.id), count(lineup_player.player_id),
    count(lineup_player.player_id) filter (where points.player_id is null)
  into v_submitted_lineups, v_selected_rows, v_missing_rows
  from public.lineup_submissions lineup
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  left join public.player_match_points points
    on points.fixture_id = lineup.fixture_id
   and points.player_id = lineup_player.player_id
   and points.calculation_version = v_calculation_version
  where lineup.fixture_id = v_fixture_id
    and lineup.status in ('submitted', 'locked');

  if v_submitted_lineups = 0 then
    raise exception 'Cannot publish Royalty Driven Match 1: no submitted lineups';
  end if;
  if v_missing_rows > 0 then
    raise exception 'Cannot publish Royalty Driven Match 1: % selected player point rows are missing', v_missing_rows;
  end if;

  insert into royalty_match_1_run_results (step, operation, status, detail)
  values (3, 'Pre-publication validation', 'PASS', jsonb_build_object(
    'submitted_lineups', v_submitted_lineups,
    'selected_player_rows', v_selected_rows,
    'missing_selected_rows', v_missing_rows,
    'calculation_version', v_calculation_version
  ));
end;
$$;

with target as (
  select fixture.id fixture_id
  from public.fixtures fixture
  join public.leagues league on league.id = fixture.league_id
  where league.slug = 'ipl-2026-royalty-test'
    and fixture.match_number = 1
), published as (
  select public.publish_match_scores_safe(target.fixture_id) result
  from target
)
insert into royalty_match_1_run_results (step, operation, status, detail)
select 4, 'Publish owner scores and royalty', 'PASS', result
from published;

with target as (
  select fixture.id fixture_id, fixture.status fixture_status,
    fixture.scoring_status, fixture.scheduled_start, fixture.lineup_lock_at
  from public.fixtures fixture
  join public.leagues league on league.id = fixture.league_id
  where league.slug = 'ipl-2026-royalty-test'
    and fixture.match_number = 1
), owner_totals as (
  select jsonb_agg(jsonb_build_object(
    'owner', member.display_name,
    'base_points', score.base_points,
    'royalty_or_adjustment', score.ownership_adjustment,
    'total_points', score.total_points,
    'rank', score.rank
  ) order by score.rank, member.display_name) totals
  from target
  join public.member_match_scores score on score.fixture_id = target.fixture_id
  join public.league_members member on member.id = score.member_id
), royalty_totals as (
  select jsonb_agg(jsonb_build_object(
    'recipient', recipient.display_name,
    'player', player.full_name,
    'type', adjustment.adjustment_type,
    'points', adjustment.adjustment_points
  ) order by recipient.display_name, player.full_name) royalties
  from target
  join public.special_player_score_adjustments adjustment
    on adjustment.fixture_id = target.fixture_id
   and adjustment.adjustment_type in ('regular_royalty', 'marquee_royalty')
  join public.league_members recipient on recipient.id = adjustment.recipient_member_id
  join public.players player on player.id = adjustment.player_id
)
insert into royalty_match_1_run_results (step, operation, status, detail)
select 5, 'Post-publication verification',
  case when target.fixture_status = 'completed'
         and target.scoring_status in ('published', 'corrected')
       then 'PASS' else 'FAIL' end,
  jsonb_build_object(
    'fixture_status', target.fixture_status,
    'scoring_status', target.scoring_status,
    'scheduled_start', target.scheduled_start,
    'lineup_lock_at', target.lineup_lock_at,
    'owner_totals', coalesce(owner_totals.totals, '[]'::jsonb),
    'royalty_details', coalesce(royalty_totals.royalties, '[]'::jsonb)
  )
from target cross join owner_totals cross join royalty_totals;

select step, operation, status, detail
from royalty_match_1_run_results
order by step;

commit;
