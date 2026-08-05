select fixture.match_number,
       count(distinct lineup.id) as visible_teams,
       count(lineup_player.player_id) as selected_player_rows,
       fixture.scoring_status
from public.fixtures fixture
left join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
where fixture.league_id = '10000000-0000-4000-8000-000000002026'
  and fixture.match_number between 1 and 5
group by fixture.id, fixture.match_number, fixture.scoring_status
order by fixture.match_number;
