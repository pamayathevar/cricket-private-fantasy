-- READ-ONLY VERIFIER: SEASON ELIGIBILITY VS AVAILABILITY
-- Expected: every boolean is true and the final query returns zero rows.
begin;
set local transaction read only;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'league_players'
      and column_name = 'season_eligible'
      and is_nullable = 'NO'
  ) as season_eligibility_installed,
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
      and league_player.season_eligible
  ) as stale_lsg_shardul_excluded_from_2026_rosters,
  exists (
    select 1
    from public.league_players league_player
    join public.leagues league on league.id = league_player.league_id
    where not league_player.active
      and league_player.season_eligible
      and league.season_year = 2026
      and league.competition = 'Indian Premier League'
  ) as valid_deactivated_player_remains_in_season_roster,
  exists (
    select 1
    from pg_constraint
    where conname = 'league_players_active_requires_season_eligibility'
      and conrelid = 'public.league_players'::regclass
  ) as active_requires_season_eligibility,
  not has_function_privilege('authenticated', 'public.validate_active_league_player_identity()', 'EXECUTE')
    as identity_guard_is_not_client_callable;

select
  league.slug,
  player.full_name,
  team.code,
  league_player.active,
  league_player.season_eligible
from public.league_players league_player
join public.leagues league on league.id = league_player.league_id
join public.players player on player.id = league_player.player_id
left join public.cricket_teams team on team.id = player.team_id
where league_player.active
  and not league_player.season_eligible;

rollback;
