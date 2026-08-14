-- READ-ONLY VERIFIER: SEASON-SCOPED LEAGUE ROSTERS
-- Expected: every boolean is true and the duplicate query returns zero rows.
begin;
set local transaction read only;

select
  to_regprocedure('public.normalized_player_name(text)') is not null
    as normalized_name_helper_installed,
  exists (
    select 1
    from pg_trigger
    where tgname = 'validate_active_league_player_identity_before_write'
      and not tgisinternal
  ) as active_identity_guard_installed,
  exists (
    select 1
    from pg_trigger
    where tgname = 'validate_player_rename_across_leagues_before_write'
      and not tgisinternal
  ) as rename_guard_installed,
  not has_function_privilege('authenticated', 'public.normalized_player_name(text)', 'EXECUTE')
    as helper_is_not_client_callable,
  not exists (
    select 1
    from public.league_players league_player
    join public.leagues league on league.id = league_player.league_id
    join public.players player on player.id = league_player.player_id
    join public.cricket_teams team on team.id = player.team_id
    where league.season_year = 2026
      and league.competition = 'Indian Premier League'
      and public.normalized_player_name(player.full_name) = 'shardul thakur'
      and team.code = 'LSG'
      and league_player.active
  ) as stale_lsg_shardul_is_inactive_in_ipl2026,
  exists (
    select 1
    from public.league_players league_player
    join public.leagues league on league.id = league_player.league_id
    join public.players player on player.id = league_player.player_id
    join public.cricket_teams team on team.id = player.team_id
    where league.slug = 'ipl-2026-royalty-test'
      and public.normalized_player_name(player.full_name) = 'shardul thakur'
      and team.code = 'MI'
      and player.role = 'AL'
      and league_player.active
  ) as current_mi_shardul_remains_active,
  exists (
    select 1
    from public.players player
    join public.cricket_teams team on team.id = player.team_id
    where public.normalized_player_name(player.full_name) = 'shardul thakur'
      and team.code = 'LSG'
  ) as historical_lsg_identity_is_preserved;

select
  league.slug,
  public.normalized_player_name(player.full_name) as player_name,
  count(*) as active_identities,
  array_agg(team.code order by team.code) as teams
from public.league_players league_player
join public.leagues league on league.id = league_player.league_id
join public.players player on player.id = league_player.player_id
left join public.cricket_teams team on team.id = player.team_id
where league_player.active
group by league.slug, public.normalized_player_name(player.full_name)
having count(*) > 1
order by league.slug, player_name;

rollback;
