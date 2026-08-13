-- Prepare three disposable leagues for remote Expo testing.
--
-- IMPORTANT:
--   * This intentionally deletes lineups, transfers and calculated/published
--     scores from the three disposable source leagues named below.
--   * The real `ipl-2026` league is never selected or modified.
--   * Run as `postgres` in the Supabase SQL editor.
--   * The first fixture is anchored at 2026-08-09 14:00 America/Toronto and
--     the existing spacing between fixtures is preserved.

begin;

do $$
declare
  v_expected integer;
begin
  select count(*) into v_expected
  from public.leagues
  where slug in (
    'ipl-2027-test',
    'special-rules-test-2028',
    'royalty-rules-test-2028'
  );

  if v_expected <> 3 then
    raise exception
      'Expected all three disposable leagues; found %. No changes were made.',
      v_expected;
  end if;

  if exists (
    select 1
    from public.leagues
    where slug in (
      'ipl-2026-open-test',
      'ipl-2026-unique-test',
      'ipl-2026-royalty-test'
    )
  ) then
    raise exception
      'One or more target remote-test slugs already exist. No changes were made.';
  end if;
end
$$;

create temporary table remote_test_leagues (
  league_id uuid primary key,
  mode text not null,
  old_slug text not null,
  new_slug text not null,
  new_name text not null
) on commit drop;

insert into remote_test_leagues (league_id, mode, old_slug, new_slug, new_name)
select id, mapping.mode, mapping.old_slug, mapping.new_slug, mapping.new_name
from (
  values
    (
      'open',
      'ipl-2027-test',
      'ipl-2026-open-test',
      'IPL 2026 [Open Players]'
    ),
    (
      'unique',
      'special-rules-test-2028',
      'ipl-2026-unique-test',
      'IPL 2026 [Unique Player Driven]'
    ),
    (
      'royalty',
      'royalty-rules-test-2028',
      'ipl-2026-royalty-test',
      'IPL 2026 [Royalty Driven]'
    )
) mapping(mode, old_slug, new_slug, new_name)
join public.leagues league on league.slug = mapping.old_slug;

-- Put the disposable leagues back into setup while their formats are changed.
update public.leagues league
set status = 'setup', updated_at = now()
from remote_test_leagues target
where league.id = target.league_id;

-- Remove all match-specific test activity. Deleting lineups cascades to lineup
-- players, lineup boosters and member match scores.
delete from public.special_player_score_adjustments adjustment
using remote_test_leagues target
where adjustment.league_id = target.league_id;

delete from public.member_match_scores score
using public.fixtures fixture, remote_test_leagues target
where score.fixture_id = fixture.id
  and fixture.league_id = target.league_id;

delete from public.player_match_points points
using public.fixtures fixture, remote_test_leagues target
where points.fixture_id = fixture.id
  and fixture.league_id = target.league_id;

delete from public.transfer_events transfer
using remote_test_leagues target
where transfer.league_id = target.league_id;

delete from public.lineup_submissions lineup
using remote_test_leagues target
where lineup.league_id = target.league_id;

-- Phase selections are test activity too. The production window trigger is
-- disabled only inside this transaction while disposable selections are reset.
alter table public.phase_special_players
  disable trigger enforce_phase_special_selection_window_before_write;

delete from public.phase_special_players selection
using remote_test_leagues target
where selection.league_id = target.league_id;

alter table public.phase_special_players
  enable trigger enforce_phase_special_selection_window_before_write;

-- Reset fixture state and move the complete schedule while preserving its
-- original intervals. The first match becomes Aug 9 at 2:00 PM Toronto time.
with anchors as (
  select
    fixture.league_id,
    min(fixture.scheduled_start) as old_first_start,
    timestamptz '2026-08-09 14:00:00-04' as new_first_start
  from public.fixtures fixture
  join remote_test_leagues target on target.league_id = fixture.league_id
  group by fixture.league_id
)
update public.fixtures fixture
set
  scheduled_start = fixture.scheduled_start
    + (anchor.new_first_start - anchor.old_first_start),
  lineup_lock_at = fixture.lineup_lock_at
    + (anchor.new_first_start - anchor.old_first_start),
  status = 'scheduled',
  scoring_status = 'pending',
  updated_at = now()
from anchors anchor
where fixture.league_id = anchor.league_id;

-- Configure the acquisition/ownership behavior for each test league.
update public.league_format_configs config
set
  acquisition_mode = case when target.mode = 'open' then 'all_open' else 'auction' end,
  ownership_enabled = target.mode <> 'open',
  bidding_enabled = false,
  other_owner_deductions_enabled = target.mode = 'unique',
  marquee_enabled = target.mode = 'royalty',
  marquee_config = case
    when target.mode = 'royalty' then jsonb_build_object('players_per_owner', 2)
    else '{}'::jsonb
  end,
  unique_players_enabled = target.mode = 'unique',
  unique_scope = case when target.mode = 'unique' then 'phase' else null end,
  unique_config = case
    when target.mode = 'unique' then jsonb_build_object(
      'players_per_owner', 2,
      'usage_fee_percent', 30,
      'minimum_usage_fee', 15,
      'restrict_captain', true,
      'restrict_vice_captain', true,
      'restrict_impact', true,
      'restrict_3x', true,
      'phase_change_deadline_hours', 24,
      'mid_phase_replacement_allowed', false
    )
    else '{}'::jsonb
  end,
  royalty_enabled = target.mode = 'royalty',
  royalty_config = case
    when target.mode = 'royalty' then jsonb_build_object(
      'regular_percent', 5,
      'regular_minimum_royalty', 5,
      'marquee_percent', 15,
      'marquee_minimum_royalty', 15,
      'zero_floor', true,
      'rounding', 'immediate_whole_point',
      'automatic_unique_enabled', true,
      'automatic_unique_usage_threshold', 56
    )
    else '{}'::jsonb
  end,
  setup_status = 'published',
  locked_at = null,
  updated_at = now()
from remote_test_leagues target
where config.league_id = target.league_id;

-- Ensure the runtime special-player rule selected for Match 1 matches the mode.
update public.special_player_rule_sets rules
set
  effective_from_match_number = 1,
  unique_mode_enabled = target.mode = 'unique',
  unique_players_per_owner = 2,
  other_player_fee_percent = 30,
  other_player_minimum_fee = 15,
  unique_restrict_captain = true,
  unique_restrict_vice_captain = true,
  unique_restrict_impact = true,
  unique_restrict_3x = true,
  marquee_mode_enabled = target.mode = 'royalty',
  marquee_players_per_owner = 2,
  regular_royalty_percent = 5,
  regular_minimum_royalty = 5,
  marquee_royalty_percent = 15,
  marquee_minimum_royalty = 15,
  royalty_zero_floor = true,
  royalty_rounding = 'immediate_whole_point',
  automatic_unique_enabled = target.mode = 'royalty',
  automatic_unique_usage_threshold = 56,
  phase_change_deadline_hours = 24,
  mid_phase_replacement_allowed = false
from remote_test_leagues target
where rules.league_id = target.league_id
  and rules.active;

-- All-open means every active squad player is genuinely open. Ownership and
-- bid prices are removed, but selection costs remain because the XI budget
-- still applies. Prefer the matching IPL 2026 selection cost; use a role-based
-- default only when the player does not exist in that source league.
update public.league_players league_player
set
  owner_member_id = null,
  acquisition_type = 'open',
  acquisition_price = coalesce(
    (
      select nullif(source_player.acquisition_price, 0)
      from public.league_players source_player
      where source_player.league_id = '10000000-0000-4000-8000-000000002026'
        and source_player.player_id = league_player.player_id
      limit 1
    ),
    (
      select case player.role
        when 'AL' then 8
        when 'BA' then 7.5
        when 'WK' then 7.5
        when 'BO' then 7.5
        else 7.5
      end
      from public.players player
      where player.id = league_player.player_id
    )
  ),
  bid_price = null,
  acquired_at = null,
  released_at = null,
  updated_at = now()
from remote_test_leagues target
where league_player.league_id = target.league_id
  and target.mode = 'open';

-- Give all existing participants access to the disposable test set.
-- Also copy any missing active IPL 2026 participants so the same remote testers
-- can enter all three leagues. Existing target identities are never duplicated.
insert into public.league_members (
  league_id,
  user_id,
  email,
  display_name,
  role,
  status,
  joined_at,
  invited_at,
  responded_at,
  participation_metadata
)
select
  target.league_id,
  source.user_id,
  source.email,
  source.display_name,
  source.role,
  'active',
  now(),
  now(),
  now(),
  jsonb_build_object(
    'remote_test_source_league_id', source.league_id,
    'remote_test_setup', true
  )
from remote_test_leagues target
join public.leagues source_league on source_league.slug = 'ipl-2026'
join public.league_members source
  on source.league_id = source_league.id
 and source.status = 'active'
where not exists (
  select 1
  from public.league_members existing
  where existing.league_id = target.league_id
    and lower(existing.email::text) = lower(source.email::text)
)
and not exists (
  select 1
  from public.league_members existing
  where existing.league_id = target.league_id
    and lower(trim(existing.display_name)) = lower(trim(source.display_name))
)
and (
  source.user_id is null
  or not exists (
    select 1
    from public.league_members existing
    where existing.league_id = target.league_id
      and existing.user_id = source.user_id
  )
);

update public.league_members member
set
  status = 'active',
  joined_at = coalesce(member.joined_at, now()),
  responded_at = coalesce(member.responded_at, now()),
  updated_at = now()
from remote_test_leagues target
where member.league_id = target.league_id
  and member.status not in ('disabled', 'declined', 'withdrawn');

-- Apply the requested labels only after all old slugs have been resolved.
update public.leagues league
set
  slug = target.new_slug,
  name = target.new_name,
  competition = 'Indian Premier League',
  season_year = 2026,
  status = 'active',
  timezone = 'America/Toronto',
  updated_at = now()
from remote_test_leagues target
where league.id = target.league_id;

commit;

-- Final verification result. Every row should say READY.
select
  league.name,
  league.slug,
  format.acquisition_mode,
  format.ownership_enabled,
  rules.unique_mode_enabled,
  rules.marquee_mode_enabled,
  rules.automatic_unique_enabled,
  count(distinct fixture.id) as fixtures,
  min(fixture.scheduled_start) as first_match,
  count(distinct lineup.id) as saved_lineups,
  count(distinct points.id) as player_point_rows,
  case
    when count(distinct fixture.id) = 74
      and min(fixture.scheduled_start) = timestamptz '2026-08-09 14:00:00-04'
      and count(distinct lineup.id) = 0
      and count(distinct points.id) = 0
    then 'READY'
    else 'CHECK'
  end as status
from public.leagues league
join public.league_format_configs format on format.league_id = league.id
join public.special_player_rule_sets rules
  on rules.league_id = league.id and rules.active
left join public.fixtures fixture on fixture.league_id = league.id
left join public.lineup_submissions lineup on lineup.league_id = league.id
left join public.player_match_points points on points.fixture_id = fixture.id
where league.slug in (
  'ipl-2026-open-test',
  'ipl-2026-unique-test',
  'ipl-2026-royalty-test'
)
group by
  league.id,
  league.name,
  league.slug,
  format.acquisition_mode,
  format.ownership_enabled,
  rules.unique_mode_enabled,
  rules.marquee_mode_enabled,
  rules.automatic_unique_enabled
order by league.name;
