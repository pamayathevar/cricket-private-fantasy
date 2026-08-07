-- Expected: every row returns PASS.
with target as (
  select fixture.id as fixture_id, league.id as league_id, fixture.phase_id
  from public.leagues league
  join public.fixtures fixture on fixture.league_id = league.id and fixture.match_number = 1
  where league.slug = 'ipl-2026-unique-test'
), declared_unique as (
  select selected.player_id, league_player.owner_member_id, player.full_name
  from target
  join lateral public.effective_phase_special_players(target.phase_id, 'unique') selected on true
  join public.league_players league_player
    on league_player.league_id = target.league_id
   and league_player.player_id = selected.player_id
   and league_player.active
  join public.players player on player.id = selected.player_id
), borrower as (
  select member.id
  from target
  join public.league_members member on member.league_id = target.league_id
  join declared_unique unique_player on unique_player.owner_member_id <> member.id
  where member.status = 'active'
  order by member.display_name
  limit 1
), markers(marker) as (
  values ('captain'::text), ('vice_captain'), ('impact'), ('3x')
)
select unique_player.full_name,
  marker.marker,
  case
    when public.player_power_restriction_reason(target.fixture_id, unique_player.owner_member_id, unique_player.player_id, marker.marker) is null
      then 'PASS'
    else 'FAIL'
  end as owner_can_use_power,
  case
    when public.player_power_restriction_reason(target.fixture_id, borrower.id, unique_player.player_id, marker.marker) is not null
      then 'PASS'
    else 'FAIL'
  end as borrower_is_restricted
from target
cross join declared_unique unique_player
cross join borrower
cross join markers marker
order by unique_player.full_name, marker.marker;
