-- DEVELOPMENT/TEST DATA ONLY.
-- Replaces Match 1 random all-squad XIs with deterministic selections from actual participants.
begin;

with participant_names(name) as (values
  ('Travis Head'),('Abhishek Sharma'),('Ishan Kishan'),('Nitish Kumar Reddy'),
  ('Heinrich Klaasen'),('Salil Arora'),('Aniket Verma'),('Harsh Dubey'),
  ('Harshal Patel'),('David Payne'),('Jaydev Unadkat'),('Eshan Malinga'),
  ('Phil Salt'),('Virat Kohli'),('Devdutt Padikkal'),('Rajat Patidar'),
  ('Jitesh Sharma'),('Tim David'),('Jacob Duffy'),('Bhuvneshwar Kumar'),
  ('Abhinandan Singh'),('Romario Shepherd'),('Suyash Sharma'),('Krunal Pandya')
), participants as (
  select player.id player_id, league_player.acquisition_price, league_player.owner_member_id
  from participant_names
  join public.players player on player.full_name = participant_names.name
  join public.league_players league_player on league_player.player_id = player.id
    and league_player.league_id = '10000000-0000-4000-8000-000000002026' and league_player.active
), ranked as (
  select lineup.id lineup_id, lineup.member_id, participants.player_id,
    participants.acquisition_price,
    participants.owner_member_id is distinct from lineup.member_id is_borrowed,
    row_number() over (
      partition by lineup.id
      order by md5(lineup.member_id::text || participants.player_id::text)
    ) slot
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  cross join participants
  where fixture.league_id = '10000000-0000-4000-8000-000000002026' and fixture.match_number = 1
), chosen as (
  select * from ranked where slot <= 11
), grouped as (
  select lineup_id,
    (array_agg(player_id order by slot))[1] captain_player_id,
    (array_agg(player_id order by slot))[2] vice_captain_player_id,
    (array_agg(player_id order by slot))[3] impact_player_id,
    sum(acquisition_price) lineup_cost,
    count(*) filter (where is_borrowed) borrowed_player_count
  from chosen group by lineup_id
)
update public.lineup_submissions lineup
set captain_player_id = grouped.captain_player_id,
    vice_captain_player_id = grouped.vice_captain_player_id,
    impact_player_id = grouped.impact_player_id,
    impact_type = case when get_byte(uuid_send(lineup.member_id), 0) % 2 = 0 then 'BAI' else 'BOI' end,
    lineup_cost = grouped.lineup_cost,
    borrowed_player_count = grouped.borrowed_player_count,
    updated_at = now()
from grouped where lineup.id = grouped.lineup_id;

delete from public.lineup_players lineup_player
using public.lineup_submissions lineup, public.fixtures fixture
where lineup_player.lineup_id = lineup.id and fixture.id = lineup.fixture_id
  and fixture.league_id = '10000000-0000-4000-8000-000000002026' and fixture.match_number = 1;

with participant_names(name) as (values
  ('Travis Head'),('Abhishek Sharma'),('Ishan Kishan'),('Nitish Kumar Reddy'),
  ('Heinrich Klaasen'),('Salil Arora'),('Aniket Verma'),('Harsh Dubey'),
  ('Harshal Patel'),('David Payne'),('Jaydev Unadkat'),('Eshan Malinga'),
  ('Phil Salt'),('Virat Kohli'),('Devdutt Padikkal'),('Rajat Patidar'),
  ('Jitesh Sharma'),('Tim David'),('Jacob Duffy'),('Bhuvneshwar Kumar'),
  ('Abhinandan Singh'),('Romario Shepherd'),('Suyash Sharma'),('Krunal Pandya')
), participants as (
  select player.id player_id, league_player.owner_member_id
  from participant_names
  join public.players player on player.full_name = participant_names.name
  join public.league_players league_player on league_player.player_id = player.id
    and league_player.league_id = '10000000-0000-4000-8000-000000002026' and league_player.active
), ranked as (
  select lineup.id lineup_id, participants.player_id,
    participants.owner_member_id is distinct from lineup.member_id is_borrowed,
    row_number() over (partition by lineup.id order by md5(lineup.member_id::text || participants.player_id::text)) slot
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  cross join participants
  where fixture.league_id = '10000000-0000-4000-8000-000000002026' and fixture.match_number = 1
)
insert into public.lineup_players (lineup_id, player_id, slot, is_borrowed)
select lineup_id, player_id, slot, is_borrowed from ranked where slot <= 11;

delete from public.member_match_scores
where fixture_id = (select id from public.fixtures where league_id = '10000000-0000-4000-8000-000000002026' and match_number = 1);
update public.player_match_points set published_at = null
where fixture_id = (select id from public.fixtures where league_id = '10000000-0000-4000-8000-000000002026' and match_number = 1);
update public.fixtures set scoring_status = 'pending', updated_at = now()
where league_id = '10000000-0000-4000-8000-000000002026' and match_number = 1;

insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
values ('10000000-0000-4000-8000-000000002026', auth.uid(), 'development_match_1_xis_reseeded',
  'fixture', (select id::text from public.fixtures where league_id = '10000000-0000-4000-8000-000000002026' and match_number = 1),
  jsonb_build_object('actual_participants_only', true, 'test_data', true));

commit;
