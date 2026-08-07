select
  to_regprocedure('public.validate_league_player_ownership_mode()') is not null
    as ownership_guard_function_installed,
  exists (
    select 1
    from pg_trigger
    where tgname = 'validate_league_player_ownership_mode_before_write'
      and not tgisinternal
  ) as ownership_guard_trigger_installed,
  not exists (
    select 1
    from public.league_players league_player
    join public.league_format_configs format
      on format.league_id = league_player.league_id
    where not format.ownership_enabled
      and league_player.owner_member_id is not null
  ) as all_open_players_have_no_owner;
