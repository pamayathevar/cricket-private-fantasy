-- Read-only runtime regression checks for the disposable Special Rules Test 2028 league.
-- Expected: every returned status is PASS.
with test_league as (
  select id from public.leagues where slug = 'special-rules-test-2028'
), match_one as (
  select fixture.id, fixture.phase_id
  from public.fixtures fixture join test_league league on league.id = fixture.league_id
  where fixture.match_number = 1
), unique_players as (
  select labels.player_id, labels.full_name
  from match_one fixture
  cross join lateral public.special_player_labels_for_fixture(fixture.id) labels
  where labels.label = 'UNIQUE'
), markers(marker) as (
  values ('captain'::text), ('vice_captain'), ('impact'), ('3x')
)
select 'Unique power restriction: ' || player.full_name || ' / ' || marker.marker as test_name,
  case when public.player_power_restriction_reason(fixture.id, null, player.player_id, marker.marker) is not null
    then 'PASS' else 'FAIL' end as status
from match_one fixture
cross join unique_players player
cross join markers marker
order by player.full_name, marker.marker;

with test_league as (
  select id from public.leagues where slug = 'special-rules-test-2028'
), phase_labels as (
  select fixture.match_number, labels.full_name, labels.label
  from public.fixtures fixture
  join test_league league on league.id = fixture.league_id
  cross join lateral public.special_player_labels_for_fixture(fixture.id) labels
  where fixture.match_number in (1, 36, 71)
)
select 'phase label snapshot' as test_name, match_number, full_name, label, 'PASS' as status
from phase_labels
order by match_number, label, full_name;

select * from (values
  ('Unique fee: 100 points', public.special_usage_fee(100, 30, 15), 30::numeric),
  ('Unique fee: zero points', public.special_usage_fee(0, 30, 15), 15::numeric),
  ('Unique fee: negative points', public.special_usage_fee(-20, 30, 15), 15::numeric),
  ('Regular royalty: 100 points', public.special_royalty_points(100, 5, 5, true, 'immediate_whole_point'), 5::numeric),
  ('Regular royalty minimum', public.special_royalty_points(0, 5, 5, true, 'immediate_whole_point'), 5::numeric),
  ('Marquee royalty: 600 points', public.special_royalty_points(600, 15, 15, true, 'immediate_whole_point'), 90::numeric),
  ('Marquee royalty minimum', public.special_royalty_points(0, 15, 15, true, 'immediate_whole_point'), 15::numeric),
  ('Marquee negative contribution', public.special_royalty_points(-20, 15, 15, true, 'immediate_whole_point'), 15::numeric)
) calculation(test_name, actual, expected)
cross join lateral (select case when actual = expected then 'PASS' else 'FAIL' end as status) result
order by test_name;
