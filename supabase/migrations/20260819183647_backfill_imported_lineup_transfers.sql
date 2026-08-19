-- The clean IPL 2026 lineup import bypassed the normal submission RPC for
-- Match 2. Reconstruct that match's per-player transfer ledger using the same
-- ownership, free-period and Super Transfer rules as normal submissions.
begin;

with ordered_lineups as (
  select
    lineup.id as lineup_id,
    lineup.league_id,
    lineup.member_id,
    lineup.fixture_id,
    fixture.match_number,
    fixture.stage,
    lag(lineup.id) over (
      partition by lineup.league_id, lineup.member_id
      order by fixture.match_number
    ) as previous_lineup_id
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  join public.leagues league on league.id = lineup.league_id
  where lineup.status in ('submitted', 'locked')
    and league.status = 'active'
    and league.name = 'IPL 2026'
    and fixture.match_number in (1, 2)
), chargeable as (
  select
    ordered.league_id,
    ordered.member_id,
    ordered.fixture_id,
    current_player.player_id,
    period.id as transfer_period_id,
    member.user_id as created_by,
    case
      when ordered.stage in ('playoff', 'final') then 'playoff'
      else 'league'
    end as transfer_stage
  from ordered_lineups ordered
  join public.lineup_players current_player
    on current_player.lineup_id = ordered.lineup_id
  join public.league_players league_player
    on league_player.league_id = ordered.league_id
   and league_player.player_id = current_player.player_id
   and league_player.active
  join public.league_members member on member.id = ordered.member_id
  join public.league_transfer_periods period
    on period.league_id = ordered.league_id
   and period.active
   and ordered.match_number between period.start_match_number and period.end_match_number
  left join public.league_format_configs format
    on format.league_id = ordered.league_id
  left join public.lineup_players previous_player
    on previous_player.lineup_id = ordered.previous_lineup_id
   and previous_player.player_id = current_player.player_id
  left join public.lineup_boosters lineup_booster
    on lineup_booster.lineup_id = ordered.lineup_id
  left join public.booster_rules booster
    on booster.id = lineup_booster.booster_rule_id
  where ordered.match_number = 2
    and not (period.first_match_free and ordered.match_number = period.start_match_number)
    and coalesce(booster.code, '') <> 'SUP-TR'
    and previous_player.player_id is null
    and (
      coalesce(format.acquisition_mode, 'auction') = 'all_open'
      or league_player.owner_member_id is distinct from ordered.member_id
    )
)
insert into public.transfer_events (
  league_id,
  member_id,
  fixture_id,
  player_in_id,
  stage,
  transfer_period_id,
  transfer_count,
  reason,
  created_by
)
select
  chargeable.league_id,
  chargeable.member_id,
  chargeable.fixture_id,
  chargeable.player_id,
  chargeable.transfer_stage,
  chargeable.transfer_period_id,
  1,
  'lineup_change',
  chargeable.created_by
from chargeable
where not exists (
  select 1
  from public.transfer_events existing
  where existing.league_id = chargeable.league_id
    and existing.member_id = chargeable.member_id
    and existing.fixture_id = chargeable.fixture_id
    and existing.player_in_id = chargeable.player_id
    and existing.reason = 'lineup_change'
);

commit;
