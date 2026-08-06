select
  to_regprocedure('public.enforce_booster_target_in_lineup()') is not null
    as integrity_function_installed,
  exists (
    select 1 from pg_trigger
    where tgname = 'validate_booster_target_after_booster_write'
      and not tgisinternal
  ) as booster_write_trigger_installed,
  exists (
    select 1 from pg_trigger
    where tgname = 'validate_booster_target_after_lineup_player_write'
      and not tgisinternal
  ) as lineup_player_trigger_installed,
  not exists (
    select 1
    from public.lineup_boosters lineup_booster
    join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
    join public.fixtures fixture on fixture.id = lineup_booster.fixture_id
    where booster.code = '3X'
      and fixture.scoring_status <> 'published'
      and lineup_booster.target_player_id is not null
      and not exists (
        select 1 from public.lineup_players lineup_player
        where lineup_player.lineup_id = lineup_booster.lineup_id
          and lineup_player.player_id = lineup_booster.target_player_id
      )
  ) as no_unpublished_invalid_3x_targets;
