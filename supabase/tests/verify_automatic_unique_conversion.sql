-- End-to-end Automatic Unique verification for a Royalty-driven test league.
-- Before running, configure a low threshold (for example 2) effective from an
-- unlocked test match that follows enough qualifying locked appearances by
-- borrowing owners in fixtures involving the player's IPL team.
-- Expected for each returned candidate:
--   label_status = PASS
--   owner_power_status = PASS
--   borrower_power_status = PASS
with target_league as (
  select id, name
  from public.leagues
  where slug = 'royalty-rules-test-2028'
), target_fixture as (
  select fixture.*
  from public.fixtures fixture
  join target_league league on league.id = fixture.league_id
  where fixture.scoring_status <> 'published'
  order by fixture.match_number
  limit 1
), context as (
  select
    fixture.id fixture_id,
    fixture.league_id,
    fixture.match_number,
    rules.automatic_unique_enabled,
    rules.automatic_unique_usage_threshold
  from target_fixture fixture
  cross join lateral public.special_player_rules_for_match(
    fixture.league_id,
    fixture.match_number
  ) rules
), player_usage as (
  select
    league_player.player_id,
    league_player.owner_member_id,
    player.full_name,
    public.automatic_unique_qualifying_usage_count(
      context.fixture_id,
      league_player.player_id
    ) usage_count
  from context
  join public.league_players league_player
    on league_player.league_id = context.league_id
   and league_player.active
   and league_player.owner_member_id is not null
  join public.players player on player.id = league_player.player_id
  group by context.fixture_id, league_player.player_id, league_player.owner_member_id, player.full_name
), candidates as (
  select usage.*
  from player_usage usage
  cross join context
  where context.automatic_unique_enabled
    and usage.usage_count > context.automatic_unique_usage_threshold
), evaluated as (
  select
    context.match_number,
    context.automatic_unique_usage_threshold threshold,
    candidate.full_name,
    candidate.usage_count,
    owner.display_name owner_name,
    borrower.display_name borrower_name,
    exists (
      select 1
      from public.special_player_labels_for_fixture(context.fixture_id) label
      where label.player_id = candidate.player_id
        and label.label = 'AUTO UNIQUE'
    ) has_auto_unique_label,
    public.player_power_restriction_reason(
      context.fixture_id, candidate.owner_member_id, candidate.player_id, 'captain'
    ) owner_reason,
    public.player_power_restriction_reason(
      context.fixture_id, borrower.id, candidate.player_id, 'captain'
    ) borrower_reason
  from candidates candidate
  cross join context
  join public.league_members owner on owner.id = candidate.owner_member_id
  cross join lateral (
    select member.id, member.display_name
    from public.league_members member
    where member.league_id = context.league_id
      and member.status = 'active'
      and member.id <> candidate.owner_member_id
    order by member.display_name
    limit 1
  ) borrower
)
select
  match_number,
  threshold,
  full_name,
  usage_count,
  owner_name,
  borrower_name,
  case when has_auto_unique_label then 'PASS' else 'FAIL' end label_status,
  case when owner_reason is null then 'PASS' else 'FAIL: ' || owner_reason end owner_power_status,
  case when borrower_reason is not null then 'PASS' else 'FAIL' end borrower_power_status,
  borrower_reason
from evaluated
order by usage_count desc, full_name;
