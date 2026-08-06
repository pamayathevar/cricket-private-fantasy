-- Read-only integrity audit for production and disposable test leagues.
-- Expected: every row reports PASS with issue_count = 0.
with checks as (
  select
    'active owner auth identity is unique per league'::text as test_name,
    count(*)::bigint as issue_count
  from (
    select league_id, user_id
    from public.league_members
    where status = 'active' and user_id is not null
    group by league_id, user_id
    having count(*) > 1
  ) duplicate_identity

  union all

  select
    'active player names are unique inside each league',
    count(*)
  from (
    select league_player.league_id, lower(trim(player.full_name)) normalized_name
    from public.league_players league_player
    join public.players player on player.id = league_player.player_id
    where league_player.active
    group by league_player.league_id, lower(trim(player.full_name))
    having count(*) > 1
  ) duplicate_player

  union all

  select
    'submitted lineups contain the configured XI size',
    count(*)
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

  union all

  select
    'selected players are active in the same league',
    count(*)
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

  union all

  select
    'captain vice and impact markers belong to the XI',
    count(*)
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

  union all

  select
    '3X targets belong to the submitted XI',
    count(*)
  from public.lineup_boosters lineup_booster
  join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
  where booster.code = '3X'
    and lineup_booster.target_player_id is not null
    and not exists (
      select 1 from public.lineup_players lineup_player
      where lineup_player.lineup_id = lineup_booster.lineup_id
        and lineup_player.player_id = lineup_booster.target_player_id
    )
)
select
  test_name,
  issue_count,
  case when issue_count = 0 then 'PASS' else 'FAIL' end as status
from checks
order by test_name;
