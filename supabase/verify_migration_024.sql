-- Read-only verification for IPL 2026 completed bid prices.
select
  member.display_name,
  count(*) filter (where league_player.owner_member_id is not null) as owned_players,
  count(*) filter (where league_player.bid_price is not null) as players_with_bid_price,
  sum(league_player.bid_price) as total_bid_cost,
  case
    when count(*) filter (where league_player.bid_price is not null) > 0 then 'OK'
    else 'NO BID PRICES'
  end as status
from public.league_members member
left join public.league_players league_player
  on league_player.league_id = member.league_id
 and league_player.owner_member_id = member.id
where member.league_id = '10000000-0000-4000-8000-000000002026'
  and member.status = 'active'
group by member.id, member.display_name
order by member.display_name;

select
  count(*) filter (where bid_price is not null) as imported_bid_prices,
  case
    when count(*) filter (where bid_price is not null) = 180 then 'OK'
    else 'EXPECTED 180 IPL 2026 BID PRICES'
  end as status
from public.league_players
where league_id = '10000000-0000-4000-8000-000000002026';
