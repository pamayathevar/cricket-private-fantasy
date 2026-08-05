select fixture.match_number, fixture.status, fixture.scoring_status,
       count(points.id) filter (where points.calculation_version = latest.version) as staged_players,
       latest.version as calculation_version,
       rules.version as points_rule_version
from public.fixtures fixture
left join lateral (
  select max(calculation_version) version
  from public.player_match_points where fixture_id = fixture.id
) latest on true
left join public.player_match_points points on points.fixture_id = fixture.id
left join public.scoring_rule_sets rules on rules.id = points.rule_set_id
where fixture.league_id = '10000000-0000-4000-8000-000000002026'
  and fixture.match_number = 1
group by fixture.id, fixture.match_number, fixture.status, fixture.scoring_status,
         latest.version, rules.version;
