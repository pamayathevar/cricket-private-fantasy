-- Populate the IPL 2027 test league with the actual IPL 2025 fixture order.
-- Source: ESPNcricinfo IPL 2025 schedule supplied by the league administrator.
-- Dates are shifted exactly two years and all fixtures remain scheduled/pending.
-- This migration never copies results, points, lineups, ownership or usage balances.
begin;

create temporary table target_ipl2027_league on commit drop as
select id, slug, name
from public.leagues
where slug = 'ipl-2027'
   or (season_year = 2027 and (lower(name) = 'ipl 2027' or competition ilike '%indian premier league%' or competition ilike '%ipl%'));

create temporary table target_ipl2027_validation (
  target_count integer not null check (target_count = 1),
  existing_lineup_count integer not null check (existing_lineup_count = 0)
) on commit drop;

insert into target_ipl2027_validation (target_count, existing_lineup_count)
select
  count(distinct target.id),
  count(submission.id)
from target_ipl2027_league target
left join public.lineup_submissions submission on submission.league_id = target.id;

create temporary table incoming_ipl2027_fixtures (
  match_number integer primary key,
  stage text not null,
  home_code text not null,
  away_code text not null,
  scheduled_start timestamptz not null,
  venue text
) on commit drop;

insert into incoming_ipl2027_fixtures
  (match_number, stage, home_code, away_code, scheduled_start, venue)
values
  (1,  'league',  'KKR',  'RCB',  '2027-03-22 14:00:00+00', 'Kolkata'),
  (2,  'league',  'SRH',  'RR',   '2027-03-23 10:00:00+00', 'Hyderabad'),
  (3,  'league',  'CSK',  'MI',   '2027-03-23 14:00:00+00', 'Chennai'),
  (4,  'league',  'DC',   'LSG',  '2027-03-24 14:00:00+00', 'Visakhapatnam'),
  (5,  'league',  'GT',   'PBKS', '2027-03-25 14:00:00+00', 'Ahmedabad'),
  (6,  'league',  'RR',   'KKR',  '2027-03-26 14:00:00+00', 'Guwahati'),
  (7,  'league',  'SRH',  'LSG',  '2027-03-27 14:00:00+00', 'Hyderabad'),
  (8,  'league',  'CSK',  'RCB',  '2027-03-28 14:00:00+00', 'Chennai'),
  (9,  'league',  'GT',   'MI',   '2027-03-29 14:00:00+00', 'Ahmedabad'),
  (10, 'league',  'DC',   'SRH',  '2027-03-30 10:00:00+00', 'Visakhapatnam'),
  (11, 'league',  'RR',   'CSK',  '2027-03-30 14:00:00+00', 'Guwahati'),
  (12, 'league',  'MI',   'KKR',  '2027-03-31 14:00:00+00', 'Mumbai'),
  (13, 'league',  'LSG',  'PBKS', '2027-04-01 14:00:00+00', 'Lucknow'),
  (14, 'league',  'RCB',  'GT',   '2027-04-02 14:00:00+00', 'Bengaluru'),
  (15, 'league',  'KKR',  'SRH',  '2027-04-03 14:00:00+00', 'Kolkata'),
  (16, 'league',  'LSG',  'MI',   '2027-04-04 14:00:00+00', 'Lucknow'),
  (17, 'league',  'CSK',  'DC',   '2027-04-05 10:00:00+00', 'Chennai'),
  (18, 'league',  'PBKS', 'RR',   '2027-04-05 14:00:00+00', 'Mullanpur'),
  (19, 'league',  'SRH',  'GT',   '2027-04-06 14:00:00+00', 'Hyderabad'),
  (20, 'league',  'MI',   'RCB',  '2027-04-07 14:00:00+00', 'Mumbai'),
  (21, 'league',  'KKR',  'LSG',  '2027-04-08 10:00:00+00', 'Kolkata'),
  (22, 'league',  'PBKS', 'CSK',  '2027-04-08 14:00:00+00', 'Mullanpur'),
  (23, 'league',  'GT',   'RR',   '2027-04-09 14:00:00+00', 'Ahmedabad'),
  (24, 'league',  'RCB',  'DC',   '2027-04-10 14:00:00+00', 'Bengaluru'),
  (25, 'league',  'CSK',  'KKR',  '2027-04-11 14:00:00+00', 'Chennai'),
  (26, 'league',  'LSG',  'GT',   '2027-04-12 10:00:00+00', 'Lucknow'),
  (27, 'league',  'SRH',  'PBKS', '2027-04-12 14:00:00+00', 'Hyderabad'),
  (28, 'league',  'RR',   'RCB',  '2027-04-13 10:00:00+00', 'Jaipur'),
  (29, 'league',  'DC',   'MI',   '2027-04-13 14:00:00+00', 'Delhi'),
  (30, 'league',  'LSG',  'CSK',  '2027-04-14 14:00:00+00', 'Lucknow'),
  (31, 'league',  'PBKS', 'KKR',  '2027-04-15 14:00:00+00', 'Mullanpur'),
  (32, 'league',  'DC',   'RR',   '2027-04-16 14:00:00+00', 'Delhi'),
  (33, 'league',  'MI',   'SRH',  '2027-04-17 14:00:00+00', 'Mumbai'),
  (34, 'league',  'RCB',  'PBKS', '2027-04-18 14:00:00+00', 'Bengaluru'),
  (35, 'league',  'GT',   'DC',   '2027-04-19 10:00:00+00', 'Ahmedabad'),
  (36, 'league',  'RR',   'LSG',  '2027-04-19 14:00:00+00', 'Jaipur'),
  (37, 'league',  'PBKS', 'RCB',  '2027-04-20 10:00:00+00', 'Mullanpur'),
  (38, 'league',  'MI',   'CSK',  '2027-04-20 14:00:00+00', 'Mumbai'),
  (39, 'league',  'KKR',  'GT',   '2027-04-21 14:00:00+00', 'Kolkata'),
  (40, 'league',  'LSG',  'DC',   '2027-04-22 14:00:00+00', 'Lucknow'),
  (41, 'league',  'SRH',  'MI',   '2027-04-23 14:00:00+00', 'Hyderabad'),
  (42, 'league',  'RCB',  'RR',   '2027-04-24 14:00:00+00', 'Bengaluru'),
  (43, 'league',  'CSK',  'SRH',  '2027-04-25 14:00:00+00', 'Chennai'),
  (44, 'league',  'KKR',  'PBKS', '2027-04-26 14:00:00+00', 'Kolkata'),
  (45, 'league',  'MI',   'LSG',  '2027-04-27 10:00:00+00', 'Mumbai'),
  (46, 'league',  'DC',   'RCB',  '2027-04-27 14:00:00+00', 'Delhi'),
  (47, 'league',  'RR',   'GT',   '2027-04-28 14:00:00+00', 'Jaipur'),
  (48, 'league',  'DC',   'KKR',  '2027-04-29 14:00:00+00', 'Delhi'),
  (49, 'league',  'CSK',  'PBKS', '2027-04-30 14:00:00+00', 'Chennai'),
  (50, 'league',  'RR',   'MI',   '2027-05-01 14:00:00+00', 'Jaipur'),
  (51, 'league',  'GT',   'SRH',  '2027-05-02 14:00:00+00', 'Ahmedabad'),
  (52, 'league',  'RCB',  'CSK',  '2027-05-03 14:00:00+00', 'Bengaluru'),
  (53, 'league',  'KKR',  'RR',   '2027-05-04 10:00:00+00', 'Kolkata'),
  (54, 'league',  'PBKS', 'LSG',  '2027-05-04 14:00:00+00', 'Dharamshala'),
  (55, 'league',  'SRH',  'DC',   '2027-05-05 14:00:00+00', 'Hyderabad'),
  (56, 'league',  'MI',   'GT',   '2027-05-06 14:00:00+00', 'Mumbai'),
  (57, 'league',  'KKR',  'CSK',  '2027-05-07 14:00:00+00', 'Kolkata'),
  (58, 'league',  'RCB',  'KKR',  '2027-05-17 14:00:00+00', 'Bengaluru'),
  (59, 'league',  'RR',   'PBKS', '2027-05-18 10:00:00+00', 'Jaipur'),
  (60, 'league',  'DC',   'GT',   '2027-05-18 14:00:00+00', 'Delhi'),
  (61, 'league',  'LSG',  'SRH',  '2027-05-19 14:00:00+00', 'Lucknow'),
  (62, 'league',  'CSK',  'RR',   '2027-05-20 14:00:00+00', 'Delhi'),
  (63, 'league',  'MI',   'DC',   '2027-05-21 14:00:00+00', 'Mumbai'),
  (64, 'league',  'GT',   'LSG',  '2027-05-22 14:00:00+00', 'Ahmedabad'),
  (65, 'league',  'RCB',  'SRH',  '2027-05-23 14:00:00+00', 'Lucknow'),
  (66, 'league',  'PBKS', 'DC',   '2027-05-24 14:00:00+00', 'Jaipur'),
  (67, 'league',  'GT',   'CSK',  '2027-05-25 10:00:00+00', 'Ahmedabad'),
  (68, 'league',  'SRH',  'KKR',  '2027-05-25 14:00:00+00', 'Delhi'),
  (69, 'league',  'PBKS', 'MI',   '2027-05-26 14:00:00+00', 'Jaipur'),
  (70, 'league',  'LSG',  'RCB',  '2027-05-27 14:00:00+00', 'Lucknow'),
  (71, 'playoff', 'PBKS', 'RCB',  '2027-05-29 14:00:00+00', 'Mullanpur'),
  (72, 'playoff', 'GT',   'MI',   '2027-05-30 14:00:00+00', 'Mullanpur'),
  (73, 'playoff', 'PBKS', 'MI',   '2027-06-01 14:00:00+00', 'Ahmedabad'),
  (74, 'final',   'RCB',  'PBKS', '2027-06-03 14:00:00+00', 'Ahmedabad');

create temporary table incoming_ipl2027_validation (
  fixture_count integer not null check (fixture_count = 74),
  missing_team_count integer not null check (missing_team_count = 0)
) on commit drop;

insert into incoming_ipl2027_validation (fixture_count, missing_team_count)
select
  count(*),
  count(*) filter (where home_team.id is null or away_team.id is null)
from incoming_ipl2027_fixtures i
left join public.cricket_teams home_team on home_team.code = i.home_code
left join public.cricket_teams away_team on away_team.code = i.away_code;

insert into public.fixtures (
  league_id, external_ref, match_number, stage,
  home_team_id, away_team_id, scheduled_start, lineup_lock_at,
  venue, status, scoring_status, scorecard_source_url
)
select
  league.id,
  'ipl-2025-template-2027-m' || lpad(i.match_number::text, 2, '0'),
  i.match_number,
  i.stage,
  home_team.id,
  away_team.id,
  i.scheduled_start,
  i.scheduled_start,
  i.venue,
  'scheduled',
  'pending',
  'https://www.cricinfo.com/series/ipl-2025-1449924/match-schedule-fixtures-and-results'
from incoming_ipl2027_fixtures i
cross join target_ipl2027_league league
join public.cricket_teams home_team on home_team.code = i.home_code
join public.cricket_teams away_team on away_team.code = i.away_code
on conflict (league_id, match_number) do update
set external_ref = excluded.external_ref,
    stage = excluded.stage,
    home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id,
    scheduled_start = excluded.scheduled_start,
    lineup_lock_at = excluded.lineup_lock_at,
    venue = excluded.venue,
    status = 'scheduled',
    scoring_status = 'pending',
    scorecard_source_url = excluded.scorecard_source_url,
    updated_at = now();

commit;
