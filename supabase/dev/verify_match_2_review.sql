-- Run after stage_match_2_points.sql and before publishing.
with target as (
  select id, scoring_status
  from public.fixtures
  where league_id = '10000000-0000-4000-8000-000000002026' and match_number = 2
), latest as (
  select max(calculation_version) calculation_version
  from public.player_match_points where fixture_id = (select id from target)
)
select player.full_name,
  point.batting_points batting,
  point.bowling_points bowling,
  point.fielding_points fielding,
  point.bonus_points bonus,
  point.total_points total,
  target.scoring_status,
  point.calculation_version
from target
cross join latest
join public.player_match_points point
  on point.fixture_id = target.id and point.calculation_version = latest.calculation_version
join public.players player on player.id = point.player_id
order by point.total_points desc, player.full_name;
