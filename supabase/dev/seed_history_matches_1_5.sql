-- DEVELOPMENT/TEST DATA ONLY.
-- Creates deterministic locked XIs for every active IPL 2026 owner/admin in Matches 1–5.
-- Safe to run repeatedly. It does not create fantasy points or publish scores.
begin;

with candidates as (
  select fixture.id fixture_id, fixture.league_id, member.id member_id,
         league_player.player_id, league_player.acquisition_price,
         league_player.owner_member_id is distinct from member.id is_borrowed,
         row_number() over (
           partition by fixture.id, member.id
           order by md5(fixture.id::text || member.id::text || league_player.player_id::text)
         ) slot
  from public.fixtures fixture
  join public.league_members member on member.league_id = fixture.league_id
    and member.status = 'active' and member.role in ('league_admin', 'owner')
  join public.league_players league_player on league_player.league_id = fixture.league_id and league_player.active
  where fixture.league_id = '10000000-0000-4000-8000-000000002026'
    and fixture.match_number between 1 and 5
), selected as (
  select * from candidates where slot <= 11
), grouped as (
  select fixture_id, league_id, member_id,
    (array_agg(player_id order by slot))[1] captain_player_id,
    (array_agg(player_id order by slot))[2] vice_captain_player_id,
    (array_agg(player_id order by slot))[3] impact_player_id,
    sum(acquisition_price) lineup_cost,
    count(*) filter (where is_borrowed) borrowed_player_count
  from selected group by fixture_id, league_id, member_id
)
insert into public.lineup_submissions (
  league_id, fixture_id, member_id, status,
  captain_player_id, vice_captain_player_id, impact_player_id, impact_type,
  lineup_cost, borrowed_player_count, submitted_at, locked_at,
  validation_status, validation_errors
)
select grouped.league_id, grouped.fixture_id, grouped.member_id, 'locked',
  grouped.captain_player_id, grouped.vice_captain_player_id,
  grouped.impact_player_id,
  case when fixture.match_number % 2 = 0 then 'BAI' else 'BOI' end,
  grouped.lineup_cost, grouped.borrowed_player_count,
  fixture.lineup_lock_at - interval '1 hour', fixture.lineup_lock_at,
  'valid', '[]'::jsonb
from grouped
join public.fixtures fixture on fixture.id = grouped.fixture_id
on conflict (fixture_id, member_id) do update set
  status = 'locked',
  captain_player_id = excluded.captain_player_id,
  vice_captain_player_id = excluded.vice_captain_player_id,
  impact_player_id = excluded.impact_player_id,
  impact_type = excluded.impact_type,
  lineup_cost = excluded.lineup_cost,
  borrowed_player_count = excluded.borrowed_player_count,
  submitted_at = excluded.submitted_at,
  locked_at = excluded.locked_at,
  validation_status = 'valid',
  validation_errors = '[]'::jsonb,
  updated_at = now();

delete from public.lineup_players lineup_player
using public.lineup_submissions lineup, public.fixtures fixture
where lineup_player.lineup_id = lineup.id
  and fixture.id = lineup.fixture_id
  and fixture.league_id = '10000000-0000-4000-8000-000000002026'
  and fixture.match_number between 1 and 5;

with candidates as (
  select lineup.id lineup_id, league_player.player_id,
    league_player.owner_member_id is distinct from lineup.member_id is_borrowed,
    row_number() over (
      partition by lineup.id
      order by md5(lineup.fixture_id::text || lineup.member_id::text || league_player.player_id::text)
    ) slot
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  join public.league_players league_player on league_player.league_id = lineup.league_id and league_player.active
  where fixture.league_id = '10000000-0000-4000-8000-000000002026'
    and fixture.match_number between 1 and 5
)
insert into public.lineup_players (lineup_id, player_id, slot, is_borrowed)
select lineup_id, player_id, slot, is_borrowed
from candidates where slot <= 11;

-- Seed the previously agreed booster examples. Boosters remain fixture-specific.
with requested(owner_name, match_number, booster_code, target_slot) as (
  values
    ('Pandiyan', 2, '3X', 1),
    ('Sashi', 3, '2UP', null),
    ('Jeba', 4, '3X', 2),
    ('Saravana', 5, '2UP', null)
)
insert into public.lineup_boosters (
  league_id, lineup_id, fixture_id, member_id, booster_rule_id, target_player_id
)
select lineup.league_id, lineup.id, lineup.fixture_id, lineup.member_id, booster.id,
  case when requested.target_slot is null then null else lineup_player.player_id end
from requested
join public.league_members member on member.league_id = '10000000-0000-4000-8000-000000002026'
  and member.display_name = requested.owner_name
join public.fixtures fixture on fixture.league_id = member.league_id and fixture.match_number = requested.match_number
join public.lineup_submissions lineup on lineup.fixture_id = fixture.id and lineup.member_id = member.id
join public.booster_rules booster on booster.league_id = member.league_id and booster.code = requested.booster_code
left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id and lineup_player.slot = requested.target_slot
on conflict (lineup_id) do update set
  booster_rule_id = excluded.booster_rule_id,
  target_player_id = excluded.target_player_id,
  updated_at = now();

insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
values ('10000000-0000-4000-8000-000000002026', auth.uid(), 'development_history_seeded',
  'league', '10000000-0000-4000-8000-000000002026',
  jsonb_build_object('matches', jsonb_build_array(1,2,3,4,5), 'test_data', true));

commit;
