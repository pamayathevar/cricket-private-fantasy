-- Read-only regression test for IPL 2026 auction transfer behavior.
-- It does not call submission RPCs or modify historical data.
with target_league as (
  select id from public.leagues where slug = 'ipl-2026'
), lineup_context as (
  select
    lineup.id as lineup_id,
    lineup.member_id,
    member.display_name,
    fixture.id as fixture_id,
    fixture.match_number,
    period.id as transfer_period_id,
    period.start_match_number,
    period.first_match_free,
    previous.lineup_id as previous_lineup_id,
    exists (
      select 1
      from public.lineup_submissions period_lineup
      join public.fixtures period_fixture on period_fixture.id = period_lineup.fixture_id
      where period_lineup.league_id = league.id
        and period_lineup.member_id = lineup.member_id
        and period_lineup.status in ('submitted', 'locked')
        and period_fixture.match_number between period.start_match_number and period.end_match_number
        and period_fixture.match_number < fixture.match_number
    ) as has_prior_period_lineup,
    exists (
      select 1
      from public.lineup_boosters lineup_booster
      join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
      where lineup_booster.lineup_id = lineup.id and booster.code = 'SUP-TR'
    ) as used_super_transfer
  from target_league league
  join public.fixtures fixture on fixture.league_id = league.id
    and fixture.match_number between 1 and 5
  join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
    and lineup.status in ('submitted', 'locked')
  join public.league_members member on member.id = lineup.member_id
  join public.league_transfer_periods period on period.league_id = league.id
    and period.active
    and fixture.match_number between period.start_match_number and period.end_match_number
  left join lateral (
    select prior.id as lineup_id
    from public.lineup_submissions prior
    join public.fixtures prior_fixture on prior_fixture.id = prior.fixture_id
    where prior.league_id = league.id
      and prior.member_id = lineup.member_id
      and prior.status in ('submitted', 'locked')
      and prior_fixture.match_number < fixture.match_number
    order by prior_fixture.match_number desc
    limit 1
  ) previous on true
), expected as (
  select
    context.*,
    case
      when context.first_match_free and not context.has_prior_period_lineup then 0
      when context.used_super_transfer then 0
      else count(*) filter (
        where league_player.owner_member_id is distinct from context.member_id
          and (
            context.previous_lineup_id is null
            or not exists (
              select 1 from public.lineup_players previous_player
              where previous_player.lineup_id = context.previous_lineup_id
                and previous_player.player_id = current_player.player_id
            )
          )
      )::integer
    end as expected_transfers
  from lineup_context context
  join public.lineup_players current_player on current_player.lineup_id = context.lineup_id
  join public.league_players league_player
    on league_player.league_id = (select id from target_league)
   and league_player.player_id = current_player.player_id
  group by
    context.lineup_id, context.member_id, context.display_name,
    context.fixture_id, context.match_number, context.transfer_period_id,
    context.start_match_number, context.first_match_free,
    context.previous_lineup_id, context.has_prior_period_lineup,
    context.used_super_transfer
), comparison as (
  select
    expected.match_number,
    expected.display_name,
    expected.expected_transfers,
    coalesce((
      select sum(event.transfer_count)
      from public.transfer_events event
      where event.league_id = (select id from target_league)
        and event.member_id = expected.member_id
        and event.fixture_id = expected.fixture_id
        and event.transfer_period_id = expected.transfer_period_id
        and event.reason = 'lineup_change'
    ), 0)::integer as recorded_transfers,
    expected.used_super_transfer
  from expected
)
select
  match_number,
  display_name,
  expected_transfers,
  recorded_transfers,
  case when expected_transfers = recorded_transfers then 'PASS' else 'FAIL' end as status,
  case when used_super_transfer then 'SUP-TR used' else '' end as detail
from comparison
order by match_number, display_name;
