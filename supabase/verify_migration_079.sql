-- Verify the IPL 2026 imported-lineup transfer backfill without changing data.
-- Rollback policy: use a reviewed forward-fix. These rows intentionally have
-- the same shape as normal submission events and must not be deleted broadly.
do $$
declare
  target_league_id uuid;
  expected_count integer;
  recorded_count integer;
begin
  if (
    select count(*)
    from public.leagues
    where status = 'active'
      and name = 'IPL 2026'
  ) <> 1 then
    raise exception 'Expected exactly one active IPL 2026 league';
  end if;

  select id
  into target_league_id
  from public.leagues
  where status = 'active'
    and name = 'IPL 2026';

  with ordered_lineups as (
    select
      lineup.id as lineup_id,
      lineup.league_id,
      lineup.member_id,
      lineup.fixture_id,
      fixture.match_number,
      lag(lineup.id) over (
        partition by lineup.league_id, lineup.member_id
        order by fixture.match_number
      ) as previous_lineup_id
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = target_league_id
      and lineup.status in ('submitted', 'locked')
      and fixture.match_number between 1 and 20
  ), expected_rows as (
    select
      ordered.league_id,
      ordered.member_id,
      ordered.fixture_id,
      current_player.player_id
    from ordered_lineups ordered
    join public.lineup_players current_player
      on current_player.lineup_id = ordered.lineup_id
    join public.league_players league_player
      on league_player.league_id = ordered.league_id
     and league_player.player_id = current_player.player_id
     and league_player.active
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
    where ordered.match_number between 2 and 20
      and not (period.first_match_free and ordered.match_number = period.start_match_number)
      and coalesce(booster.code, '') <> 'SUP-TR'
      and previous_player.player_id is null
      and (
        coalesce(format.acquisition_mode, 'auction') = 'all_open'
        or league_player.owner_member_id is distinct from ordered.member_id
      )
  )
  select count(*)
  into expected_count
  from expected_rows;

  select coalesce(sum(event.transfer_count), 0)::integer
  into recorded_count
  from public.transfer_events event
  join public.fixtures fixture on fixture.id = event.fixture_id
  where event.league_id = target_league_id
    and event.reason = 'lineup_change'
    and fixture.match_number between 1 and 20;

  if expected_count <> recorded_count then
    raise exception 'Transfer count mismatch: expected %, recorded %', expected_count, recorded_count;
  end if;

  if exists (
    with ordered_lineups as (
      select
        lineup.id as lineup_id,
        lineup.league_id,
        lineup.member_id,
        lineup.fixture_id,
        fixture.match_number,
        lag(lineup.id) over (
          partition by lineup.league_id, lineup.member_id
          order by fixture.match_number
        ) as previous_lineup_id
      from public.lineup_submissions lineup
      join public.fixtures fixture on fixture.id = lineup.fixture_id
      where lineup.league_id = target_league_id
        and lineup.status in ('submitted', 'locked')
        and fixture.match_number between 1 and 20
    ), expected_rows as (
      select
        ordered.league_id,
        ordered.member_id,
        ordered.fixture_id,
        current_player.player_id
      from ordered_lineups ordered
      join public.lineup_players current_player
        on current_player.lineup_id = ordered.lineup_id
      join public.league_players league_player
        on league_player.league_id = ordered.league_id
       and league_player.player_id = current_player.player_id
       and league_player.active
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
      where ordered.match_number between 2 and 20
        and not (period.first_match_free and ordered.match_number = period.start_match_number)
        and coalesce(booster.code, '') <> 'SUP-TR'
        and previous_player.player_id is null
        and (
          coalesce(format.acquisition_mode, 'auction') = 'all_open'
          or league_player.owner_member_id is distinct from ordered.member_id
        )
    ), recorded_rows as (
      select
        event.league_id,
        event.member_id,
        event.fixture_id,
        event.player_in_id as player_id,
        event.transfer_count
      from public.transfer_events event
      join public.fixtures fixture on fixture.id = event.fixture_id
      where event.league_id = target_league_id
        and event.reason = 'lineup_change'
        and fixture.match_number between 1 and 20
    )
    select 1
    from expected_rows expected
    full join recorded_rows recorded
      on recorded.league_id = expected.league_id
     and recorded.member_id = expected.member_id
     and recorded.fixture_id = expected.fixture_id
     and recorded.player_id = expected.player_id
     and recorded.transfer_count = 1
    where expected.player_id is null
       or recorded.player_id is null
  ) then
    raise exception 'Transfer ledger contains a missing, extra or malformed player event';
  end if;

  if exists (
    select 1
    from public.transfer_events event
    join public.fixtures fixture on fixture.id = event.fixture_id
    where event.league_id = target_league_id
      and event.reason = 'lineup_change'
      and fixture.match_number between 1 and 20
    group by event.member_id, event.fixture_id, event.player_in_id, event.reason
    having count(*) > 1
  ) then
    raise exception 'Transfer ledger contains duplicate player events';
  end if;

  if exists (
    select 1
    from public.transfer_events event
    join public.fixtures fixture on fixture.id = event.fixture_id
    where event.league_id = target_league_id
      and event.reason = 'lineup_change'
      and fixture.match_number between 1 and 20
      and event.transfer_period_id is null
  ) then
    raise exception 'Transfer ledger contains events without a transfer period';
  end if;
end;
$$;
