-- Expected: all values in the first result are true. The second result should
-- return no rows after affected owners resubmit an earlier unlocked lineup.
with definition as (
  select pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  ) body
)
select
  to_regprocedure('public.recalculate_next_submitted_lineup_transfers(uuid,uuid,integer)') is not null
    as recalculation_helper_installed,
  position('recalculate_next_submitted_lineup_transfers' in body) > 0
    as submission_recalculates_next_future_lineup,
  position('used_fixture.match_number < v_fixture.match_number' in body) > 0
    as current_submission_uses_only_prior_transfer_events,
  not has_function_privilege(
    'authenticated',
    'public.recalculate_next_submitted_lineup_transfers(uuid,uuid,integer)',
    'EXECUTE'
  ) as helper_is_not_client_callable
from definition;

with lineup_context as (
  select
    lineup.id as lineup_id,
    lineup.league_id,
    lineup.member_id,
    fixture.id as fixture_id,
    fixture.match_number,
    member.display_name,
    league.name as league_name,
    period.id as transfer_period_id,
    period.first_match_free,
    previous.lineup_id as previous_lineup_id,
    coalesce(config.acquisition_mode, 'auction') as acquisition_mode,
    exists (
      select 1 from public.lineup_boosters lineup_booster
      join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
      where lineup_booster.lineup_id = lineup.id and booster.code = 'SUP-TR'
    ) as uses_super_transfer,
    exists (
      select 1 from public.lineup_submissions period_lineup
      join public.fixtures period_fixture on period_fixture.id = period_lineup.fixture_id
      where period_lineup.league_id = lineup.league_id
        and period_lineup.member_id = lineup.member_id
        and period_lineup.status in ('submitted', 'locked')
        and period_fixture.match_number between period.start_match_number and period.end_match_number
        and period_fixture.match_number < fixture.match_number
    ) as has_prior_period_lineup
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  join public.leagues league on league.id = lineup.league_id
  join public.league_members member on member.id = lineup.member_id
  join public.league_transfer_periods period on period.league_id = lineup.league_id
    and period.active
    and fixture.match_number between period.start_match_number and period.end_match_number
  left join public.league_format_configs config on config.league_id = lineup.league_id
  left join lateral (
    select prior.id as lineup_id
    from public.lineup_submissions prior
    join public.fixtures prior_fixture on prior_fixture.id = prior.fixture_id
    where prior.league_id = lineup.league_id
      and prior.member_id = lineup.member_id
      and prior.status in ('submitted', 'locked')
      and prior_fixture.match_number < fixture.match_number
    order by prior_fixture.match_number desc
    limit 1
  ) previous on true
  where lineup.status = 'submitted'
    and fixture.status = 'scheduled'
    and now() < coalesce(fixture.lineup_lock_at, fixture.scheduled_start)
), comparison as (
  select context.*,
    case
      when context.first_match_free and not context.has_prior_period_lineup then 0
      when context.uses_super_transfer then 0
      else (
        select count(*)::integer
        from public.lineup_players current_player
        join public.league_players league_player
          on league_player.league_id = context.league_id
         and league_player.player_id = current_player.player_id
         and league_player.active
        where current_player.lineup_id = context.lineup_id
          and (context.acquisition_mode = 'all_open' or league_player.owner_member_id is distinct from context.member_id)
          and (context.previous_lineup_id is null or not exists (
            select 1 from public.lineup_players previous_player
            where previous_player.lineup_id = context.previous_lineup_id
              and previous_player.player_id = current_player.player_id
          ))
      )
    end as expected_transfers,
    coalesce((
      select sum(event.transfer_count)::integer
      from public.transfer_events event
      where event.league_id = context.league_id
        and event.member_id = context.member_id
        and event.fixture_id = context.fixture_id
        and event.reason = 'lineup_change'
    ), 0) as recorded_transfers
  from lineup_context context
)
select league_name, display_name, match_number, expected_transfers, recorded_transfers
from comparison
where expected_transfers <> recorded_transfers
order by league_name, display_name, match_number;
