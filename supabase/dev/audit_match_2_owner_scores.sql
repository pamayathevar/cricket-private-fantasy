-- Run only after Match 2 is published.
select member.display_name,
       score.rank,
       score.total_points,
       booster.codes as boosters,
       score.calculation_breakdown,
       count(lineup_player.player_id) as lineup_players,
       count(points.player_id) as players_with_points
from public.fixtures fixture
join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
join public.league_members member on member.id = lineup.member_id
left join public.member_match_scores score on score.lineup_id = lineup.id
left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
left join public.player_match_points points on points.fixture_id = fixture.id
  and points.player_id = lineup_player.player_id
  and points.calculation_version = (
    select max(calculation_version)
    from public.player_match_points
    where fixture_id = fixture.id and published_at is not null
  )
left join lateral (
  select string_agg(rule.code, ', ' order by rule.code) codes
  from public.lineup_boosters lineup_booster
  join public.booster_rules rule on rule.id = lineup_booster.booster_rule_id
  where lineup_booster.lineup_id = lineup.id
) booster on true
where fixture.league_id = '10000000-0000-4000-8000-000000002026'
  and fixture.match_number = 2
group by member.display_name, score.rank, score.total_points,
         booster.codes, score.calculation_breakdown
order by score.rank nulls last, member.display_name;
