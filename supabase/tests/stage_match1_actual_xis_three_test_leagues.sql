-- TEST DATA ONLY.
-- Stages the actual IPL 2026 Match 1 owner XIs from Google Sheet
-- `Copy of IPL2026` -> `League!A1:DP18` into the three disposable leagues:
--   * ipl-2026-open-test
--   * ipl-2026-unique-test
--   * ipl-2026-royalty-test
--
-- Safe to run repeatedly. The real `ipl-2026` league is never modified.
-- Run as postgres in the Supabase SQL editor.

begin;

drop table if exists pg_temp.match1_actual_xi;
create temporary table match1_actual_xi (
  owner_email text not null,
  owner_name text not null,
  slot integer not null check (slot between 1 and 11),
  player_name text not null,
  marker text check (marker is null or marker in ('C', 'VC', 'BAI', 'BOI')),
  primary key (owner_email, slot),
  unique (owner_email, player_name)
);

insert into match1_actual_xi (owner_email, owner_name, slot, player_name, marker)
values
  ('baluinfo@gmail.com', 'Bala', 1, 'Romario Shepherd', 'VC'),
  ('baluinfo@gmail.com', 'Bala', 2, 'Eshan Malinga', null),
  ('baluinfo@gmail.com', 'Bala', 3, 'Hardik Pandya', null),
  ('baluinfo@gmail.com', 'Bala', 4, 'Angkrish Raghuvanshi', null),
  ('baluinfo@gmail.com', 'Bala', 5, 'Tilak Varma', null),
  ('baluinfo@gmail.com', 'Bala', 6, 'Virat Kohli', null),
  ('baluinfo@gmail.com', 'Bala', 7, 'Travis Head', 'BAI'),
  ('baluinfo@gmail.com', 'Bala', 8, 'Ishan Kishan', 'C'),
  ('baluinfo@gmail.com', 'Bala', 9, 'Abhishek Sharma', null),
  ('baluinfo@gmail.com', 'Bala', 10, 'Krunal Pandya', null),
  ('baluinfo@gmail.com', 'Bala', 11, 'Jasprit Bumrah', null),

  ('jebarajsam@gmail.com', 'Jeba', 1, 'Phil Salt', 'VC'),
  ('jebarajsam@gmail.com', 'Jeba', 2, 'Virat Kohli', 'BAI'),
  ('jebarajsam@gmail.com', 'Jeba', 3, 'Rajat Patidar', null),
  ('jebarajsam@gmail.com', 'Jeba', 4, 'Ishan Kishan', null),
  ('jebarajsam@gmail.com', 'Jeba', 5, 'Heinrich Klaasen', null),
  ('jebarajsam@gmail.com', 'Jeba', 6, 'Romario Shepherd', null),
  ('jebarajsam@gmail.com', 'Jeba', 7, 'Abhishek Sharma', 'C'),
  ('jebarajsam@gmail.com', 'Jeba', 8, 'Travis Head', null),
  ('jebarajsam@gmail.com', 'Jeba', 9, 'Tim David', null),
  ('jebarajsam@gmail.com', 'Jeba', 10, 'Suyash Sharma', null),
  ('jebarajsam@gmail.com', 'Jeba', 11, 'Harshal Patel', null),

  ('johnyamarnath@gmail.com', 'Johny', 1, 'Phil Salt', null),
  ('johnyamarnath@gmail.com', 'Johny', 2, 'Suryakumar Yadav', null),
  ('johnyamarnath@gmail.com', 'Johny', 3, 'Krunal Pandya', 'C'),
  ('johnyamarnath@gmail.com', 'Johny', 4, 'Sunil Narine', null),
  ('johnyamarnath@gmail.com', 'Johny', 5, 'Travis Head', null),
  ('johnyamarnath@gmail.com', 'Johny', 6, 'Virat Kohli', 'BAI'),
  ('johnyamarnath@gmail.com', 'Johny', 7, 'Heinrich Klaasen', null),
  ('johnyamarnath@gmail.com', 'Johny', 8, 'Varun Chakravarthy', null),
  ('johnyamarnath@gmail.com', 'Johny', 9, 'Ishan Kishan', 'VC'),
  ('johnyamarnath@gmail.com', 'Johny', 10, 'Abhishek Sharma', null),
  ('johnyamarnath@gmail.com', 'Johny', 11, 'Jaydev Unadkat', null),

  ('osa.mansurahamad@gmail.com', 'Mansur', 1, 'Tim David', 'C'),
  ('osa.mansurahamad@gmail.com', 'Mansur', 2, 'Phil Salt', 'BAI'),
  ('osa.mansurahamad@gmail.com', 'Mansur', 3, 'Nitish Kumar Reddy', 'VC'),
  ('osa.mansurahamad@gmail.com', 'Mansur', 4, 'Abhishek Sharma', null),
  ('osa.mansurahamad@gmail.com', 'Mansur', 5, 'Ishan Kishan', null),
  ('osa.mansurahamad@gmail.com', 'Mansur', 6, 'Rajat Patidar', null),
  ('osa.mansurahamad@gmail.com', 'Mansur', 7, 'Varun Chakravarthy', null),
  ('osa.mansurahamad@gmail.com', 'Mansur', 8, 'Noor Ahmad', null),
  ('osa.mansurahamad@gmail.com', 'Mansur', 9, 'Ajinkya Rahane', null),
  ('osa.mansurahamad@gmail.com', 'Mansur', 10, 'Rohit Sharma', null),
  ('osa.mansurahamad@gmail.com', 'Mansur', 11, 'Hardik Pandya', null),

  ('muralikg24@gmail.com', 'Murali', 1, 'Bhuvneshwar Kumar', null),
  ('muralikg24@gmail.com', 'Murali', 2, 'Jitesh Sharma', null),
  ('muralikg24@gmail.com', 'Murali', 3, 'Harshal Patel', null),
  ('muralikg24@gmail.com', 'Murali', 4, 'Nitish Kumar Reddy', null),
  ('muralikg24@gmail.com', 'Murali', 5, 'Virat Kohli', 'BAI'),
  ('muralikg24@gmail.com', 'Murali', 6, 'Abhishek Sharma', 'C'),
  ('muralikg24@gmail.com', 'Murali', 7, 'Heinrich Klaasen', null),
  ('muralikg24@gmail.com', 'Murali', 8, 'Jasprit Bumrah', null),
  ('muralikg24@gmail.com', 'Murali', 9, 'Ishan Kishan', 'VC'),
  ('muralikg24@gmail.com', 'Murali', 10, 'Travis Head', null),
  ('muralikg24@gmail.com', 'Murali', 11, 'Ruturaj Gaikwad', null),

  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 1, 'Abhinandan Singh', null),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 2, 'Hardik Pandya', null),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 3, 'Suryakumar Yadav', null),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 4, 'Virat Kohli', 'BAI'),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 5, 'Rajat Patidar', null),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 6, 'Bhuvneshwar Kumar', null),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 7, 'Romario Shepherd', null),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 8, 'Abhishek Sharma', 'C'),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 9, 'Nitish Kumar Reddy', 'VC'),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 10, 'Ishan Kishan', null),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 11, 'Travis Head', null),

  ('saransamy@gmail.com', 'Saravana', 1, 'Devdutt Padikkal', 'BAI'),
  ('saransamy@gmail.com', 'Saravana', 2, 'Mangesh Yadav', null),
  ('saransamy@gmail.com', 'Saravana', 3, 'Aniket Verma', null),
  ('saransamy@gmail.com', 'Saravana', 4, 'Zeeshan Ansari', null),
  ('saransamy@gmail.com', 'Saravana', 5, 'Virat Kohli', 'C'),
  ('saransamy@gmail.com', 'Saravana', 6, 'Ishan Kishan', 'VC'),
  ('saransamy@gmail.com', 'Saravana', 7, 'Travis Head', null),
  ('saransamy@gmail.com', 'Saravana', 8, 'Ruturaj Gaikwad', null),
  ('saransamy@gmail.com', 'Saravana', 9, 'Yashasvi Jaiswal', null),
  ('saransamy@gmail.com', 'Saravana', 10, 'Sanju Samson', null),
  ('saransamy@gmail.com', 'Saravana', 11, 'Varun Chakravarthy', null),

  ('sashi511@gmail.com', 'Sashi', 1, 'Romario Shepherd', null),
  ('sashi511@gmail.com', 'Sashi', 2, 'Nitish Kumar Reddy', null),
  ('sashi511@gmail.com', 'Sashi', 3, 'Virat Kohli', 'C'),
  ('sashi511@gmail.com', 'Sashi', 4, 'Eshan Malinga', null),
  ('sashi511@gmail.com', 'Sashi', 5, 'Venkatesh Iyer', null),
  ('sashi511@gmail.com', 'Sashi', 6, 'Abhishek Sharma', 'VC'),
  ('sashi511@gmail.com', 'Sashi', 7, 'Heinrich Klaasen', null),
  ('sashi511@gmail.com', 'Sashi', 8, 'Phil Salt', null),
  ('sashi511@gmail.com', 'Sashi', 9, 'Suryakumar Yadav', null),
  ('sashi511@gmail.com', 'Sashi', 10, 'Travis Head', 'BAI'),
  ('sashi511@gmail.com', 'Sashi', 11, 'Rasikh Salam', null),

  ('tamilkrishna.info@gmail.com', 'Tamil', 1, 'Phil Salt', 'VC'),
  ('tamilkrishna.info@gmail.com', 'Tamil', 2, 'Ishan Kishan', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 3, 'Yashasvi Jaiswal', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 4, 'Travis Head', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 5, 'Shubman Gill', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 6, 'Virat Kohli', 'C'),
  ('tamilkrishna.info@gmail.com', 'Tamil', 7, 'Suryakumar Yadav', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 8, 'Jasprit Bumrah', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 9, 'Abhishek Sharma', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 10, 'Ruturaj Gaikwad', null),
  ('tamilkrishna.info@gmail.com', 'Tamil', 11, 'Jacob Duffy', 'BOI');

drop table if exists pg_temp.match1_targets;
create temporary table match1_targets as
select
  league.id as league_id,
  league.slug,
  fixture.id as fixture_id,
  member.id as member_id,
  member.email,
  source.owner_name,
  source.slot,
  source.player_name,
  source.marker,
  player.id as player_id,
  league_player.owner_member_id,
  coalesce(league_player.acquisition_price, 0) as selection_cost,
  format.ownership_enabled
from public.leagues league
join public.fixtures fixture
  on fixture.league_id = league.id and fixture.match_number = 1
join match1_actual_xi source on true
join public.league_members member
  on member.league_id = league.id
 and lower(member.email) = lower(source.owner_email)
 and member.status = 'active'
join public.players player on player.full_name = source.player_name
join public.league_players league_player
  on league_player.league_id = league.id
 and league_player.player_id = player.id
 and league_player.active
join public.league_format_configs format on format.league_id = league.id
where league.slug in (
  'ipl-2026-open-test',
  'ipl-2026-unique-test',
  'ipl-2026-royalty-test'
);

do $$
declare
  v_target_leagues integer;
  v_source_rows integer;
  v_resolved_rows integer;
  v_bad_owners text;
begin
  select count(*) into v_target_leagues
  from public.leagues
  where slug in (
    'ipl-2026-open-test',
    'ipl-2026-unique-test',
    'ipl-2026-royalty-test'
  );

  if v_target_leagues <> 3 then
    raise exception 'Expected all three disposable test leagues; found %', v_target_leagues;
  end if;

  select count(*) into v_source_rows from match1_actual_xi;
  select count(*) into v_resolved_rows from match1_targets;

  if v_source_rows <> 99 then
    raise exception 'Expected 99 source XI rows; found %', v_source_rows;
  end if;

  if v_resolved_rows <> 297 then
    raise exception
      'Expected 297 resolved rows (99 x 3 leagues); found %. Check members, player names and active league-player rows.',
      v_resolved_rows;
  end if;

  select string_agg(slug || ':' || owner_name || '=' || player_count, ', ' order by slug, owner_name)
  into v_bad_owners
  from (
    select slug, owner_name, count(*)::text as player_count
    from match1_targets
    group by slug, owner_name
    having count(*) <> 11
  ) invalid;

  if v_bad_owners is not null then
    raise exception 'Every staged owner must resolve to 11 active players: %', v_bad_owners;
  end if;
end
$$;

-- Remove any prior Match 1 booster/transfer artifacts for these nine owners.
delete from public.lineup_boosters booster
using match1_targets target
where booster.fixture_id = target.fixture_id
  and booster.member_id = target.member_id;

delete from public.transfer_events transfer
using match1_targets target
where transfer.fixture_id = target.fixture_id
  and transfer.member_id = target.member_id;

-- Upsert the submitted lineup headers with the exact Sheet markers.
with grouped as (
  select
    league_id,
    fixture_id,
    member_id,
    (array_agg(player_id) filter (where marker = 'C'))[1] as captain_player_id,
    (array_agg(player_id) filter (where marker = 'VC'))[1] as vice_captain_player_id,
    (array_agg(player_id) filter (where marker in ('BAI', 'BOI')))[1] as impact_player_id,
    max(marker) filter (where marker in ('BAI', 'BOI')) as impact_type,
    sum(selection_cost) as lineup_cost,
    count(*) filter (
      where ownership_enabled
        and owner_member_id is distinct from member_id
    ) as borrowed_player_count
  from match1_targets
  group by league_id, fixture_id, member_id
)
insert into public.lineup_submissions (
  league_id,
  fixture_id,
  member_id,
  status,
  captain_player_id,
  vice_captain_player_id,
  impact_player_id,
  impact_type,
  lineup_cost,
  borrowed_player_count,
  submitted_at,
  locked_at,
  validation_status,
  validation_errors
)
select
  league_id,
  fixture_id,
  member_id,
  'submitted',
  captain_player_id,
  vice_captain_player_id,
  impact_player_id,
  impact_type,
  lineup_cost,
  borrowed_player_count,
  now(),
  null,
  'valid',
  '[]'::jsonb
from grouped
on conflict (fixture_id, member_id) do update
set status = 'submitted',
    captain_player_id = excluded.captain_player_id,
    vice_captain_player_id = excluded.vice_captain_player_id,
    impact_player_id = excluded.impact_player_id,
    impact_type = excluded.impact_type,
    lineup_cost = excluded.lineup_cost,
    borrowed_player_count = excluded.borrowed_player_count,
    submitted_at = excluded.submitted_at,
    locked_at = null,
    validation_status = 'valid',
    validation_errors = '[]'::jsonb,
    updated_at = now();

delete from public.lineup_players lineup_player
using public.lineup_submissions lineup, match1_targets target
where lineup_player.lineup_id = lineup.id
  and lineup.fixture_id = target.fixture_id
  and lineup.member_id = target.member_id;

insert into public.lineup_players (lineup_id, player_id, slot, is_borrowed)
select
  lineup.id,
  target.player_id,
  target.slot,
  target.ownership_enabled
    and target.owner_member_id is distinct from target.member_id
from match1_targets target
join public.lineup_submissions lineup
  on lineup.fixture_id = target.fixture_id
 and lineup.member_id = target.member_id
order by target.slug, target.owner_name, target.slot;

-- The source sheet records Jeba using 2UP for Match 1.
insert into public.lineup_boosters (
  league_id,
  lineup_id,
  fixture_id,
  member_id,
  booster_rule_id,
  target_player_id
)
select
  target.league_id,
  lineup.id,
  target.fixture_id,
  target.member_id,
  booster.id,
  null
from (
  select distinct league_id, fixture_id, member_id, email
  from match1_targets
) target
join public.lineup_submissions lineup
  on lineup.fixture_id = target.fixture_id
 and lineup.member_id = target.member_id
join public.booster_rules booster
  on booster.league_id = target.league_id
 and booster.code = '2UP'
 and booster.active
where lower(target.email) = 'jebarajsam@gmail.com'
on conflict (lineup_id) do update
set booster_rule_id = excluded.booster_rule_id,
    target_player_id = null,
    updated_at = now();

insert into public.audit_events (
  league_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  after_data
)
select
  league.id,
  auth.uid(),
  'test_match_1_actual_xis_staged',
  'fixture',
  fixture.id::text,
  jsonb_build_object(
    'match_number', 1,
    'owners', 9,
    'players_per_owner', 11,
    'source', 'Copy of IPL2026 / League!A1:DP18',
    'test_data', true
  )
from public.leagues league
join public.fixtures fixture
  on fixture.league_id = league.id and fixture.match_number = 1
where league.slug in (
  'ipl-2026-open-test',
  'ipl-2026-unique-test',
  'ipl-2026-royalty-test'
);

commit;

-- A successful run returns 27 PASS rows: nine owners in each test league.
select
  league.name as league_name,
  member.display_name,
  count(lineup_player.player_id) as selected_players,
  captain.full_name as captain,
  vice_captain.full_name as vice_captain,
  impact.full_name as impact_player,
  lineup.impact_type,
  coalesce(booster.code, '-') as booster,
  lineup.lineup_cost,
  lineup.borrowed_player_count,
  case
    when count(lineup_player.player_id) = 11
     and lineup.status = 'submitted'
     and captain.id is not null
     and vice_captain.id is not null
     and impact.id is not null
    then 'PASS'
    else 'FAIL'
  end as status
from public.leagues league
join public.fixtures fixture
  on fixture.league_id = league.id and fixture.match_number = 1
join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
join public.league_members member on member.id = lineup.member_id
left join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
left join public.players captain on captain.id = lineup.captain_player_id
left join public.players vice_captain on vice_captain.id = lineup.vice_captain_player_id
left join public.players impact on impact.id = lineup.impact_player_id
left join public.lineup_boosters lineup_booster on lineup_booster.lineup_id = lineup.id
left join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
where league.slug in (
  'ipl-2026-open-test',
  'ipl-2026-unique-test',
  'ipl-2026-royalty-test'
)
and lower(member.email) in (
  'baluinfo@gmail.com',
  'jebarajsam@gmail.com',
  'johnyamarnath@gmail.com',
  'osa.mansurahamad@gmail.com',
  'muralikg24@gmail.com',
  'pandiyan.mayathevar@gmail.com',
  'saransamy@gmail.com',
  'sashi511@gmail.com',
  'tamilkrishna.info@gmail.com'
)
group by
  league.name,
  league.slug,
  member.display_name,
  member.email,
  lineup.id,
  lineup.status,
  captain.id,
  captain.full_name,
  vice_captain.id,
  vice_captain.full_name,
  impact.id,
  impact.full_name,
  booster.code
order by league.slug, lower(member.display_name);
