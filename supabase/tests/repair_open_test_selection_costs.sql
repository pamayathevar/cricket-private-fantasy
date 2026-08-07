-- Repair selection costs in the already-created remote Open Players league.
-- Run as postgres in the Supabase SQL editor.
--
-- Open Players removes ownership and bid prices, not the XI selection cost.
-- Matching players inherit the real IPL 2026 cost. Players not present in the
-- source league receive a role-based fallback so nobody remains at Rs 0m.

begin;

do $$
begin
  if not exists (
    select 1 from public.leagues where slug = 'ipl-2026-open-test'
  ) then
    raise exception 'Open Players test league does not exist';
  end if;
end
$$;

update public.league_players target_player
set
  owner_member_id = null,
  acquisition_type = 'open',
  acquisition_price = coalesce(
    nullif(source_player.acquisition_price, 0),
    case player.role
      when 'AL' then 8
      when 'BA' then 7.5
      when 'WK' then 7.5
      when 'BO' then 7.5
      else 7.5
    end
  ),
  bid_price = null,
  acquired_at = null,
  released_at = null,
  updated_at = now()
from public.leagues target_league
join public.players player on true
left join public.league_players source_player
  on source_player.league_id = '10000000-0000-4000-8000-000000002026'
 and source_player.player_id = player.id
where target_league.slug = 'ipl-2026-open-test'
  and target_player.league_id = target_league.id
  and player.id = target_player.player_id;

commit;

-- Expected: zero_cost_players = 0 and minimum_cost > 0.
select
  count(*) filter (where league_player.acquisition_price <= 0) as zero_cost_players,
  min(league_player.acquisition_price) as minimum_cost,
  max(league_player.acquisition_price) as maximum_cost,
  round(avg(league_player.acquisition_price), 2) as average_cost,
  count(*) as players
from public.league_players league_player
join public.leagues league on league.id = league_player.league_id
where league.slug = 'ipl-2026-open-test'
  and league_player.active;
