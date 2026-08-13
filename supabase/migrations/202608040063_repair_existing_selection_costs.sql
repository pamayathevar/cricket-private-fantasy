-- Repair existing IPL league-player rows whose selection cost is below the
-- current positive minimum for their league. This includes inactive players so
-- reactivation cannot reintroduce an invalid cost.
begin;

create temporary table selection_cost_repairs on commit drop as
with league_minimums as (
  select
    lp.league_id,
    min(lp.acquisition_price) as minimum_selection_cost
  from public.league_players lp
  join public.leagues league on league.id = lp.league_id
  join public.players player on player.id = lp.player_id
  join public.cricket_teams team on team.id = player.team_id
  where league.competition = 'Indian Premier League'
    and lp.active
    and player.active
    and team.active
    and lp.acquisition_price > 0
  group by lp.league_id
)
select
  lp.id as league_player_id,
  lp.league_id,
  lp.player_id,
  lp.acquisition_price as previous_selection_cost,
  minimum.minimum_selection_cost
from public.league_players lp
join public.leagues league on league.id = lp.league_id
join league_minimums minimum on minimum.league_id = lp.league_id
where league.competition = 'Indian Premier League'
  and lp.acquisition_price < minimum.minimum_selection_cost;

insert into public.audit_events (
  league_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data
)
select
  repair.league_id,
  null,
  'selection_cost_repaired',
  'league_player',
  repair.league_player_id::text,
  jsonb_build_object(
    'selection_cost', repair.previous_selection_cost
  ),
  jsonb_build_object(
    'selection_cost', repair.minimum_selection_cost,
    'repair_reason', 'below_current_ipl_minimum'
  )
from selection_cost_repairs repair;

update public.league_players lp
set acquisition_price = repair.minimum_selection_cost,
    updated_at = now()
from selection_cost_repairs repair
where lp.id = repair.league_player_id;

commit;
