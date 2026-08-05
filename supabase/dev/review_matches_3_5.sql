-- Run after stage_matches_3_5_points.sql. One result set for all three matches.
with fixtures as (
  select id, match_number, status, scoring_status
  from public.fixtures
  where league_id = '10000000-0000-4000-8000-000000002026' and match_number between 3 and 5
), latest as (
  select fixture_id, max(calculation_version) calculation_version
  from public.player_match_points where fixture_id in (select id from fixtures) group by fixture_id
), selected as (
  select lineup.fixture_id, count(*) selected_rows
  from public.lineup_submissions lineup
  join public.lineup_players player on player.lineup_id = lineup.id
  where lineup.fixture_id in (select id from fixtures) and lineup.status in ('submitted','locked')
  group by lineup.fixture_id
), staged as (
  select points.fixture_id, count(*) staged_rows, sum(points.total_points) player_points_total
  from public.player_match_points points
  join latest on latest.fixture_id = points.fixture_id and latest.calculation_version = points.calculation_version
  group by points.fixture_id
), missing as (
  select lineup.fixture_id, count(*) missing_rows
  from public.lineup_submissions lineup
  join public.lineup_players player on player.lineup_id = lineup.id
  join latest on latest.fixture_id = lineup.fixture_id
  where lineup.fixture_id in (select id from fixtures) and lineup.status in ('submitted','locked')
    and not exists (select 1 from public.player_match_points points where points.fixture_id = lineup.fixture_id and points.player_id = player.player_id and points.calculation_version = latest.calculation_version)
  group by lineup.fixture_id
)
select fixture.match_number, fixture.status, fixture.scoring_status,
  latest.calculation_version, coalesce(selected.selected_rows,0) selected_player_rows,
  coalesce(staged.staged_rows,0) staged_players, coalesce(missing.missing_rows,0) missing_selected_rows,
  coalesce(staged.player_points_total,0) player_points_total,
  case fixture.match_number when 3 then 814 when 4 then 1017 when 5 then 895 end expected_player_points_total,
  case when fixture.scoring_status = 'review'
    and coalesce(selected.selected_rows,0) > 0
    and coalesce(missing.missing_rows,0) = 0
    and coalesce(staged.player_points_total,0) = case fixture.match_number when 3 then 814 when 4 then 1017 when 5 then 895 end
    then 'READY TO PUBLISH' else 'NOT READY' end review_status
from fixtures fixture
left join latest on latest.fixture_id = fixture.id
left join selected on selected.fixture_id = fixture.id
left join staged on staged.fixture_id = fixture.id
left join missing on missing.fixture_id = fixture.id
order by fixture.match_number;
