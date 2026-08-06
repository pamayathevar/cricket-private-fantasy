-- Read-only integrity audit for production and disposable test leagues.
-- Expected: every row reports PASS with issue_count = 0.
-- Scalar checks avoid UNION column-shape problems in the SQL Editor.
with checks(test_name, issue_count) as (
  values
    (
      'active owner auth identity is unique per league'::text,
      (
        select count(*)::bigint
        from (
          select league_id, user_id
          from public.league_members
          where status = 'active' and user_id is not null
          group by league_id, user_id
          having count(*) > 1
        ) duplicate_identity
      )
    ),
    (
      'active player names are unique inside each league'::text,
      (
        select count(*)::bigint
        from (
          select league_player.league_id, lower(trim(player.full_name)) normalized_name
          from public.league_players league_player
          join public.players player on player.id = league_player.player_id
          where league_player.active
          group by league_player.league_id, lower(trim(player.full_name))
          having count(*) > 1
        ) duplicate_player
      )
    ),
    (
      'submitted lineups contain the configured XI size'::text,
      (
        select count(*)::bigint
        from (
          select lineup.id
          from public.lineup_submissions lineup
          join public.fixtures fixture on fixture.id = lineup.fixture_id
          join public.lineup_rule_sets rules
            on rules.id = public.lineup_rule_set_for_fixture(fixture.id)
          left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
          where lineup.status in ('submitted', 'locked')
          group by lineup.id, rules.lineup_size
          having count(lineup_player.player_id) <> rules.lineup_size
        ) invalid_size
      )
    ),
    (
      'selected players are active in the same league'::text,
      (
        select count(*)::bigint
        from public.lineup_submissions lineup
        join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
        where lineup.status in ('submitted', 'locked')
          and not exists (
            select 1
            from public.league_players league_player
            where league_player.league_id = lineup.league_id
              and league_player.player_id = lineup_player.player_id
              and league_player.active
          )
      )
    ),
    (
      'captain vice and impact markers belong to the XI'::text,
      (
        select count(*)::bigint
        from public.lineup_submissions lineup
        cross join lateral unnest(array[
          lineup.captain_player_id,
          lineup.vice_captain_player_id,
          lineup.impact_player_id
        ]) marker(player_id)
        where lineup.status in ('submitted', 'locked')
          and marker.player_id is not null
          and not exists (
            select 1 from public.lineup_players lineup_player
            where lineup_player.lineup_id = lineup.id
              and lineup_player.player_id = marker.player_id
          )
      )
    ),
    (
      'unpublished 3X targets belong to the submitted XI'::text,
      (
        select count(*)::bigint
        from public.lineup_boosters lineup_booster
        join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
        join public.fixtures fixture on fixture.id = lineup_booster.fixture_id
        where booster.code = '3X'
          and fixture.scoring_status <> 'published'
          and lineup_booster.target_player_id is not null
          and not exists (
            select 1 from public.lineup_players lineup_player
            where lineup_player.lineup_id = lineup_booster.lineup_id
              and lineup_player.player_id = lineup_booster.target_player_id
          )
      )
    )
)
select
  test_name,
  issue_count,
  case when issue_count = 0 then 'PASS' else 'FAIL' end as status
from checks
order by test_name;
