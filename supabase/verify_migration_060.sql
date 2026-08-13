-- Expected: the first query returns all true and the remaining queries return no rows.
with definitions as (
  select
    pg_get_functiondef(
      'public.automatic_unique_qualifying_usage_count(uuid,uuid)'::regprocedure
    ) usage_body,
    pg_get_functiondef(
      'public.special_player_labels_for_fixture(uuid)'::regprocedure
    ) labels_body,
    pg_get_functiondef(
      'public.player_power_restriction_reason(uuid,uuid,uuid,text)'::regprocedure
    ) restriction_body
)
select
  to_regprocedure(
    'public.automatic_unique_qualifying_usage_count(uuid,uuid)'
  ) is not null as qualifying_usage_helper_installed,
  position('lineup.member_id <> league_player.owner_member_id' in usage_body) > 0
    and position('lineup_player.is_borrowed' in usage_body) > 0
    as owner_appearances_excluded,
  position('player.team_id in (used_fixture.home_team_id, used_fixture.away_team_id)' in usage_body) > 0
    as only_player_team_fixtures_counted,
  position('used_fixture.match_number < target_fixture.match_number' in usage_body) > 0
    as only_prior_fixtures_counted,
  position('used_fixture.status not in (''abandoned'', ''cancelled'')' in usage_body) > 0
    as no_result_fixtures_excluded,
  position('automatic_unique_qualifying_usage_count' in labels_body) > 0
    as label_uses_shared_counter,
  position('automatic_unique_qualifying_usage_count' in restriction_body) > 0
    as power_restriction_uses_shared_counter,
  not has_function_privilege(
    'anon',
    'public.automatic_unique_qualifying_usage_count(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.automatic_unique_qualifying_usage_count(uuid,uuid)',
    'EXECUTE'
  ) as helper_is_not_client_callable
from definitions;

-- The helper must match an independently aggregated count for every owned
-- player at every fixture. This catches owner-use or unrelated-fixture leakage.
with expected_usage as (
  select
    target_fixture.id fixture_id,
    league_player.player_id,
    count(lineup_player.player_id)::integer expected_count
  from public.fixtures target_fixture
  join public.league_players league_player
    on league_player.league_id = target_fixture.league_id
   and league_player.active
   and league_player.owner_member_id is not null
  join public.players player on player.id = league_player.player_id
  left join public.fixtures used_fixture
    on used_fixture.league_id = target_fixture.league_id
   and used_fixture.match_number < target_fixture.match_number
   and used_fixture.status not in ('abandoned', 'cancelled')
   and (
     used_fixture.status in ('live', 'completed')
     or now() >= used_fixture.lineup_lock_at
   )
   and player.team_id in (used_fixture.home_team_id, used_fixture.away_team_id)
  left join public.lineup_submissions lineup
    on lineup.fixture_id = used_fixture.id
   and lineup.member_id <> league_player.owner_member_id
   and lineup.status in ('submitted', 'locked')
  left join public.lineup_players lineup_player
    on lineup_player.lineup_id = lineup.id
   and lineup_player.player_id = league_player.player_id
   and lineup_player.is_borrowed
  group by target_fixture.id, league_player.player_id
)
select
  expected.fixture_id,
  expected.player_id,
  expected.expected_count,
  public.automatic_unique_qualifying_usage_count(
    expected.fixture_id,
    expected.player_id
  ) actual_count
from expected_usage expected
where expected.expected_count <> public.automatic_unique_qualifying_usage_count(
  expected.fixture_id,
  expected.player_id
);

-- Every fixture-effective AUTO UNIQUE label must exceed the configured
-- threshold using the corrected borrowed/team-fixture counter.
select
  fixture.league_id,
  fixture.match_number,
  label.full_name,
  public.automatic_unique_qualifying_usage_count(fixture.id, label.player_id) qualifying_usage,
  rules.automatic_unique_usage_threshold threshold
from public.fixtures fixture
cross join lateral public.special_player_rules_for_match(
  fixture.league_id,
  fixture.match_number
) rules
cross join lateral public.special_player_labels_for_fixture(fixture.id) label
where label.label = 'AUTO UNIQUE'
  and public.automatic_unique_qualifying_usage_count(fixture.id, label.player_id)
      <= rules.automatic_unique_usage_threshold;
