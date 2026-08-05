-- Read-only verification for the IPL 2025 squad imported into IPL 2027.
with target as (
  select id
  from public.leagues
  where slug = 'ipl-2027'
     or (
       season_year = 2027
       and (
         lower(name) = 'ipl 2027'
         or competition ilike '%indian premier league%'
         or competition ilike '%ipl%'
       )
     )
), squad as (
  select team.code as team_code, player.role, league_player.*
  from public.league_players league_player
  join public.players player on player.id = league_player.player_id
  join public.cricket_teams team on team.id = player.team_id
  where league_player.league_id = (select id from target)
    and league_player.active
)
select
  team_code,
  count(*) as players,
  count(*) filter (where role = 'BA') as batters,
  count(*) filter (where role = 'WK') as wicketkeepers,
  count(*) filter (where role = 'AL') as allrounders,
  count(*) filter (where role = 'BO') as bowlers,
  count(*) filter (
    where owner_member_id is not null
       or acquisition_type <> 'open'
       or acquisition_price <> 0
  ) as non_open_players
from squad
group by team_code
order by team_code;
