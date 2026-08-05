-- Run after submitting Match 1, then carrying that XI to Match 2 and replacing
-- exactly three players in IPL 2027 test.
with target_league as (
  select id from public.leagues where slug = 'ipl-2027-test'
), submitted as (
  select
    fixture.match_number,
    member.display_name,
    lineup.id as lineup_id,
    count(lineup_player.player_id)::integer as selected_players
  from target_league league
  join public.fixtures fixture on fixture.league_id = league.id and fixture.match_number in (1, 2)
  join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
    and lineup.status in ('submitted', 'locked')
  join public.league_members member on member.id = lineup.member_id
  left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  group by fixture.match_number, member.display_name, lineup.id
), transfer_totals as (
  select
    fixture.match_number,
    event.member_id,
    coalesce(sum(event.transfer_count), 0)::integer as transfers_charged
  from target_league league
  join public.fixtures fixture on fixture.league_id = league.id and fixture.match_number in (1, 2)
  left join public.transfer_events event on event.fixture_id = fixture.id
    and event.reason = 'lineup_change'
  group by fixture.match_number, event.member_id
)
select
  submitted.match_number,
  submitted.display_name,
  submitted.selected_players,
  coalesce(transfer_totals.transfers_charged, 0) as transfers_charged,
  case
    when submitted.match_number = 1 and coalesce(transfer_totals.transfers_charged, 0) = 0 then 'PASS'
    when submitted.match_number = 2 and coalesce(transfer_totals.transfers_charged, 0) = 3 then 'PASS'
    else 'CHECK'
  end as expected_result
from submitted
left join public.league_members member
  on member.display_name = submitted.display_name
 and member.league_id = (select id from target_league)
left join transfer_totals
  on transfer_totals.match_number = submitted.match_number
 and transfer_totals.member_id = member.id
order by submitted.display_name, submitted.match_number;
