with league_minimums as (
  select
    lp.league_id,
    min(lp.acquisition_price) filter (
      where lp.active
        and player.active
        and team.active
        and lp.acquisition_price > 0
    ) as minimum_selection_cost
  from public.league_players lp
  join public.leagues league on league.id = lp.league_id
  join public.players player on player.id = lp.player_id
  join public.cricket_teams team on team.id = player.team_id
  where league.competition = 'Indian Premier League'
  group by lp.league_id
), remaining_invalid as (
  select count(*) as player_count
  from public.league_players lp
  join league_minimums minimum on minimum.league_id = lp.league_id
  where minimum.minimum_selection_cost is not null
    and lp.acquisition_price < minimum.minimum_selection_cost
), repaired as (
  select count(*) as player_count
  from public.audit_events
  where action = 'selection_cost_repaired'
)
select
  (select player_count from remaining_invalid) = 0 as all_existing_selection_costs_valid,
  (select player_count from repaired) as repaired_player_count;
