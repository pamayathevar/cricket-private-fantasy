-- Stage and lock the nine real-owner XIs for Match 2 in IPL 2026 [Royalty Driven].
-- Source: Google Sheet `League`, block `M2_MI_vs_KKR` (`League!A53:DV66`).
-- No Match 2 booster is selected in the source sheet.
-- Run as one complete query in the Supabase SQL Editor (role: postgres).

begin;

drop table if exists pg_temp.match2_sheet_xi;
create temporary table match2_sheet_xi (
  owner_email text not null,
  owner_name text not null,
  expected_transfers integer not null check (expected_transfers >= 0),
  slot integer not null check (slot between 1 and 11),
  player_name text not null,
  marker text check (marker is null or marker in ('C', 'VC', 'BAI', 'BOI')),
  primary key (owner_email, slot),
  unique (owner_email, player_name)
) on commit drop;

insert into match2_sheet_xi
  (owner_email, owner_name, expected_transfers, slot, player_name, marker)
values
  ('baluinfo@gmail.com','Bala',1,1,'Vaibhav Arora',null),
  ('baluinfo@gmail.com','Bala',1,2,'Eshan Malinga',null),
  ('baluinfo@gmail.com','Bala',1,3,'Hardik Pandya',null),
  ('baluinfo@gmail.com','Bala',1,4,'Angkrish Raghuvanshi','C'),
  ('baluinfo@gmail.com','Bala',1,5,'Tilak Varma','BAI'),
  ('baluinfo@gmail.com','Bala',1,6,'Virat Kohli',null),
  ('baluinfo@gmail.com','Bala',1,7,'Trent Boult','VC'),
  ('baluinfo@gmail.com','Bala',1,8,'Ishan Kishan',null),
  ('baluinfo@gmail.com','Bala',1,9,'Saurabh Dubey',null),
  ('baluinfo@gmail.com','Bala',1,10,'Finn Allen',null),
  ('baluinfo@gmail.com','Bala',1,11,'Jasprit Bumrah',null),

  ('jebarajsam@gmail.com','Jeba',0,1,'Phil Salt',null),
  ('jebarajsam@gmail.com','Jeba',0,2,'Virat Kohli',null),
  ('jebarajsam@gmail.com','Jeba',0,3,'Rajat Patidar',null),
  ('jebarajsam@gmail.com','Jeba',0,4,'Ishan Kishan',null),
  ('jebarajsam@gmail.com','Jeba',0,5,'Ryan Rickelton','C'),
  ('jebarajsam@gmail.com','Jeba',0,6,'Sunil Narine','VC'),
  ('jebarajsam@gmail.com','Jeba',0,7,'Abhishek Sharma',null),
  ('jebarajsam@gmail.com','Jeba',0,8,'Travis Head',null),
  ('jebarajsam@gmail.com','Jeba',0,9,'Tim David',null),
  ('jebarajsam@gmail.com','Jeba',0,10,'Kartik Tyagi','BOI'),
  ('jebarajsam@gmail.com','Jeba',0,11,'Harshal Patel',null),

  ('johnyamarnath@gmail.com','Johny',2,1,'Phil Salt',null),
  ('johnyamarnath@gmail.com','Johny',2,2,'Suryakumar Yadav',null),
  ('johnyamarnath@gmail.com','Johny',2,3,'Rohit Sharma','BAI'),
  ('johnyamarnath@gmail.com','Johny',2,4,'Sunil Narine','C'),
  ('johnyamarnath@gmail.com','Johny',2,5,'Travis Head',null),
  ('johnyamarnath@gmail.com','Johny',2,6,'Finn Allen',null),
  ('johnyamarnath@gmail.com','Johny',2,7,'Heinrich Klaasen',null),
  ('johnyamarnath@gmail.com','Johny',2,8,'Varun Chakravarthy','VC'),
  ('johnyamarnath@gmail.com','Johny',2,9,'Abhishek Sharma',null),
  ('johnyamarnath@gmail.com','Johny',2,10,'Ishan Kishan',null),
  ('johnyamarnath@gmail.com','Johny',2,11,'Jaydev Unadkat',null),

  ('osa.mansurahamad@gmail.com','Mansur',1,1,'Varun Chakravarthy',null),
  ('osa.mansurahamad@gmail.com','Mansur',1,2,'Ajinkya Rahane',null),
  ('osa.mansurahamad@gmail.com','Mansur',1,3,'Rohit Sharma',null),
  ('osa.mansurahamad@gmail.com','Mansur',1,4,'Hardik Pandya','VC'),
  ('osa.mansurahamad@gmail.com','Mansur',1,5,'Cameron Green','C'),
  ('osa.mansurahamad@gmail.com','Mansur',1,6,'Finn Allen',null),
  ('osa.mansurahamad@gmail.com','Mansur',1,7,'Jasprit Bumrah','BOI'),
  ('osa.mansurahamad@gmail.com','Mansur',1,8,'Noor Ahmad',null),
  ('osa.mansurahamad@gmail.com','Mansur',1,9,'Abhishek Sharma',null),
  ('osa.mansurahamad@gmail.com','Mansur',1,10,'Ishan Kishan',null),
  ('osa.mansurahamad@gmail.com','Mansur',1,11,'Rajat Patidar',null),

  ('muralikg24@gmail.com','Murali',2,1,'Rinku Singh','VC'),
  ('muralikg24@gmail.com','Murali',2,2,'Suryakumar Yadav','BAI'),
  ('muralikg24@gmail.com','Murali',2,3,'Harshal Patel',null),
  ('muralikg24@gmail.com','Murali',2,4,'Finn Allen','C'),
  ('muralikg24@gmail.com','Murali',2,5,'Blessing Muzarabani',null),
  ('muralikg24@gmail.com','Murali',2,6,'Abhishek Sharma',null),
  ('muralikg24@gmail.com','Murali',2,7,'Heinrich Klaasen',null),
  ('muralikg24@gmail.com','Murali',2,8,'Jasprit Bumrah',null),
  ('muralikg24@gmail.com','Murali',2,9,'Ishan Kishan',null),
  ('muralikg24@gmail.com','Murali',2,10,'Travis Head',null),
  ('muralikg24@gmail.com','Murali',2,11,'Ruturaj Gaikwad',null),

  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,1,'Varun Chakravarthy',null),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,2,'Angkrish Raghuvanshi','VC'),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,3,'Hardik Pandya','C'),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,4,'Suryakumar Yadav',null),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,5,'Shardul Thakur',null),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,6,'Rohit Sharma','BAI'),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,7,'Rajat Patidar',null),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,8,'Bhuvneshwar Kumar',null),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,9,'Travis Head',null),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,10,'Nitish Kumar Reddy',null),
  ('pandiyan.mayathevar@gmail.com','Pandiyan',1,11,'Ishan Kishan',null),

  ('saransamy@gmail.com','Saravana',0,1,'Deepak Chahar','VC'),
  ('saransamy@gmail.com','Saravana',0,2,'Hardik Pandya','C'),
  ('saransamy@gmail.com','Saravana',0,3,'Ajinkya Rahane','BAI'),
  ('saransamy@gmail.com','Saravana',0,4,'Zeeshan Ansari',null),
  ('saransamy@gmail.com','Saravana',0,5,'Virat Kohli',null),
  ('saransamy@gmail.com','Saravana',0,6,'Ishan Kishan',null),
  ('saransamy@gmail.com','Saravana',0,7,'Travis Head',null),
  ('saransamy@gmail.com','Saravana',0,8,'Ruturaj Gaikwad',null),
  ('saransamy@gmail.com','Saravana',0,9,'Yashasvi Jaiswal',null),
  ('saransamy@gmail.com','Saravana',0,10,'Sanju Samson',null),
  ('saransamy@gmail.com','Saravana',0,11,'Varun Chakravarthy',null),

  ('sashi511@gmail.com','Sashi',0,1,'Ramandeep Singh',null),
  ('sashi511@gmail.com','Sashi',0,2,'Matheesha Pathirana',null),
  ('sashi511@gmail.com','Sashi',0,3,'Heinrich Klaasen',null),
  ('sashi511@gmail.com','Sashi',0,4,'Virat Kohli',null),
  ('sashi511@gmail.com','Sashi',0,5,'Tilak Varma','C'),
  ('sashi511@gmail.com','Sashi',0,6,'Abhishek Sharma',null),
  ('sashi511@gmail.com','Sashi',0,7,'Naman Dhir','VC'),
  ('sashi511@gmail.com','Sashi',0,8,'Phil Salt',null),
  ('sashi511@gmail.com','Sashi',0,9,'Suryakumar Yadav','BAI'),
  ('sashi511@gmail.com','Sashi',0,10,'Travis Head',null),
  ('sashi511@gmail.com','Sashi',0,11,'AM Ghazanfar',null),

  ('tamilkrishna.info@gmail.com','Tamil',1,1,'Sherfane Rutherford','VC'),
  ('tamilkrishna.info@gmail.com','Tamil',1,2,'Ishan Kishan',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,3,'Yashasvi Jaiswal',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,4,'Finn Allen',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,5,'Shubman Gill',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,6,'Rohit Sharma','C'),
  ('tamilkrishna.info@gmail.com','Tamil',1,7,'Suryakumar Yadav',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,8,'Jasprit Bumrah',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,9,'Abhishek Sharma',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,10,'Ruturaj Gaikwad',null),
  ('tamilkrishna.info@gmail.com','Tamil',1,11,'Mayank Markande','BOI');

drop table if exists pg_temp.match2_targets;
create temporary table match2_targets as
select
  league.id as league_id,
  fixture.id as fixture_id,
  fixture.stage,
  member.id as member_id,
  member.user_id,
  source.owner_email,
  source.owner_name,
  source.expected_transfers,
  source.slot,
  source.player_name,
  source.marker,
  player.id as player_id,
  league_player.owner_member_id,
  coalesce(league_player.acquisition_price, 0) as selection_cost,
  period.id as transfer_period_id
from public.leagues league
join public.fixtures fixture
  on fixture.league_id = league.id and fixture.match_number = 2
join match2_sheet_xi source on true
join public.league_members member
  on member.league_id = league.id
 and lower(member.email) = lower(source.owner_email)
 and member.status = 'active'
join public.league_players league_player
  on league_player.league_id = league.id
join public.players player
  on player.id = league_player.player_id and player.full_name = source.player_name
left join public.league_transfer_periods period
  on period.league_id = league.id
 and period.active
 and fixture.match_number between period.start_match_number and period.end_match_number
where league.slug = 'ipl-2026-royalty-test';

do $$
declare
  v_source_rows integer;
  v_resolved_rows integer;
  v_owner_count integer;
  v_bad text;
begin
  select count(*), count(distinct owner_email)
  into v_source_rows, v_owner_count
  from match2_sheet_xi;

  if v_source_rows <> 99 or v_owner_count <> 9 then
    raise exception 'Source must contain 9 owners x 11 players; found % rows and % owners',
      v_source_rows, v_owner_count;
  end if;

  select count(*) into v_resolved_rows from match2_targets;
  if v_resolved_rows <> 99 then
    select string_agg(source.player_name, ', ' order by source.player_name)
    into v_bad
    from match2_sheet_xi source
    where not exists (
      select 1 from match2_targets target
      where target.owner_email = source.owner_email
        and target.slot = source.slot
    );
    raise exception 'Expected 99 resolved league-player rows; found %. Missing: %',
      v_resolved_rows, coalesce(v_bad, 'unknown/duplicate mapping');
  end if;

  select string_agg(invalid.owner_name || ': ' || invalid.detail, '; ' order by invalid.owner_name)
  into v_bad
  from (
    select owner_name,
      format('players=%s C=%s VC=%s impact=%s periods=%s',
        count(*),
        count(*) filter (where marker = 'C'),
        count(*) filter (where marker = 'VC'),
        count(*) filter (where marker in ('BAI','BOI')),
        count(distinct transfer_period_id)) as detail
    from match2_targets
    group by owner_name
    having count(*) <> 11
       or count(*) filter (where marker = 'C') <> 1
       or count(*) filter (where marker = 'VC') <> 1
       or count(*) filter (where marker in ('BAI','BOI')) <> 1
       or count(distinct transfer_period_id) <> 1
  ) invalid;

  if v_bad is not null then
    raise exception 'Invalid Match 2 owner data: %', v_bad;
  end if;
end;
$$;

-- Replace only Match 2 artifacts for the nine source owners.
delete from public.lineup_boosters booster
using (select distinct fixture_id, member_id from match2_targets) target
where booster.fixture_id = target.fixture_id
  and booster.member_id = target.member_id;

delete from public.transfer_events event
using (select distinct fixture_id, member_id from match2_targets) target
where event.fixture_id = target.fixture_id
  and event.member_id = target.member_id
  and event.reason = 'lineup_change';

with grouped as (
  select
    league_id,
    fixture_id,
    member_id,
    (array_agg(player_id order by slot) filter (where marker = 'C'))[1] as captain_player_id,
    (array_agg(player_id order by slot) filter (where marker = 'VC'))[1] as vice_captain_player_id,
    (array_agg(player_id order by slot) filter (where marker in ('BAI','BOI')))[1] as impact_player_id,
    max(marker) filter (where marker in ('BAI','BOI')) as impact_type,
    sum(selection_cost) as lineup_cost,
    count(*) filter (where owner_member_id is distinct from member_id) as borrowed_player_count
  from match2_targets
  group by league_id, fixture_id, member_id
)
insert into public.lineup_submissions (
  league_id, fixture_id, member_id, status,
  captain_player_id, vice_captain_player_id, impact_player_id, impact_type,
  lineup_cost, borrowed_player_count, submitted_at, locked_at,
  validation_status, validation_errors
)
select
  league_id, fixture_id, member_id, 'submitted',
  captain_player_id, vice_captain_player_id, impact_player_id, impact_type,
  lineup_cost, borrowed_player_count, now(), null,
  'valid', '[]'::jsonb
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
using public.lineup_submissions lineup,
      (select distinct fixture_id, member_id from match2_targets) target
where lineup_player.lineup_id = lineup.id
  and lineup.fixture_id = target.fixture_id
  and lineup.member_id = target.member_id;

insert into public.lineup_players (lineup_id, player_id, slot, is_borrowed)
select
  lineup.id,
  target.player_id,
  target.slot,
  target.owner_member_id is distinct from target.member_id
from match2_targets target
join public.lineup_submissions lineup
  on lineup.fixture_id = target.fixture_id
 and lineup.member_id = target.member_id
order by target.owner_name, target.slot;

-- Record charged incoming borrowed players relative to the locked Match 1 XI.
insert into public.transfer_events (
  league_id, member_id, fixture_id, player_in_id, stage,
  transfer_period_id, transfer_count, reason, created_by
)
select
  target.league_id,
  target.member_id,
  target.fixture_id,
  target.player_id,
  case when target.stage in ('playoff','final') then 'playoff' else 'league' end,
  target.transfer_period_id,
  1,
  'lineup_change',
  target.user_id
from match2_targets target
where target.owner_member_id is distinct from target.member_id
  and not exists (
    select 1
    from public.lineup_submissions previous_lineup
    join public.fixtures previous_fixture on previous_fixture.id = previous_lineup.fixture_id
    join public.lineup_players previous_player on previous_player.lineup_id = previous_lineup.id
    where previous_lineup.league_id = target.league_id
      and previous_lineup.member_id = target.member_id
      and previous_fixture.match_number = 1
      and previous_player.player_id = target.player_id
  );

do $$
declare v_bad text;
begin
  select string_agg(checks.owner_name || ': expected ' || checks.expected_transfers ||
                    ', calculated ' || checks.calculated_transfers, '; ' order by checks.owner_name)
  into v_bad
  from (
    select
      target.owner_name,
      max(target.expected_transfers) as expected_transfers,
      count(distinct event.id)::integer as calculated_transfers
    from match2_targets target
    left join public.transfer_events event
      on event.fixture_id = target.fixture_id
     and event.member_id = target.member_id
     and event.reason = 'lineup_change'
    group by target.owner_name, target.member_id
  ) checks
  where checks.expected_transfers <> checks.calculated_transfers;

  if v_bad is not null then
    raise exception 'Sheet transfer balances do not reconcile: %', v_bad;
  end if;
end;
$$;

-- Lock after every XI, marker and transfer has passed validation.
update public.lineup_submissions lineup
set status = 'locked',
    locked_at = now(),
    updated_at = now()
from (select distinct fixture_id, member_id from match2_targets) target
where lineup.fixture_id = target.fixture_id
  and lineup.member_id = target.member_id;

update public.fixtures fixture
set lineup_lock_at = now() - interval '1 minute',
    scheduled_start = now() - interval '1 minute',
    status = 'live',
    scoring_status = 'pending',
    updated_at = now()
from (select distinct fixture_id from match2_targets) target
where fixture.id = target.fixture_id;

insert into public.audit_events (
  league_id, actor_user_id, action, entity_type, entity_id, after_data
)
select
  league.id,
  auth.uid(),
  'match_2_sheet_xis_staged_and_locked',
  'fixture',
  fixture.id::text,
  jsonb_build_object(
    'match_number', 2,
    'owners', 9,
    'players_per_owner', 11,
    'boosters', 0,
    'source', 'Google Sheet League!A53:DV66 / M2_MI_vs_KKR'
  )
from public.leagues league
join public.fixtures fixture
  on fixture.league_id = league.id and fixture.match_number = 2
where league.slug = 'ipl-2026-royalty-test';

commit;

-- Expected result: nine PASS rows, fixture_status=live, lineup_status=locked.
select
  member.display_name,
  coalesce(player_count.selected_players, 0) as selected_players,
  captain.full_name as captain,
  vice.full_name as vice_captain,
  impact.full_name as impact_player,
  lineup.impact_type,
  coalesce(booster_rule.code, '-') as booster,
  coalesce(transfer_count.transfers_charged, 0) as transfers_charged,
  fixture.status as fixture_status,
  fixture.scoring_status,
  lineup.status as lineup_status,
  case
    when coalesce(player_count.selected_players, 0) = 11
     and captain.id is not null
     and vice.id is not null
     and impact.id is not null
     and booster_rule.id is null
     and fixture.status = 'live'
     and fixture.scoring_status = 'pending'
     and lineup.status = 'locked'
     and now() >= fixture.lineup_lock_at
    then 'PASS'
    else 'FAIL'
  end as status
from public.leagues league
join public.fixtures fixture
  on fixture.league_id = league.id and fixture.match_number = 2
join public.lineup_submissions lineup on lineup.fixture_id = fixture.id
join public.league_members member on member.id = lineup.member_id
left join lateral (
  select count(*) as selected_players
  from public.lineup_players lineup_player
  where lineup_player.lineup_id = lineup.id
) player_count on true
left join public.players captain on captain.id = lineup.captain_player_id
left join public.players vice on vice.id = lineup.vice_captain_player_id
left join public.players impact on impact.id = lineup.impact_player_id
left join public.lineup_boosters booster on booster.lineup_id = lineup.id
left join public.booster_rules booster_rule on booster_rule.id = booster.booster_rule_id
left join lateral (
  select count(*) as transfers_charged
  from public.transfer_events transfer_event
  where transfer_event.fixture_id = fixture.id
    and transfer_event.member_id = member.id
    and transfer_event.reason = 'lineup_change'
) transfer_count on true
where league.slug = 'ipl-2026-royalty-test'
  and lower(member.email) in (
    'baluinfo@gmail.com','jebarajsam@gmail.com','johnyamarnath@gmail.com',
    'osa.mansurahamad@gmail.com','muralikg24@gmail.com',
    'pandiyan.mayathevar@gmail.com','saransamy@gmail.com',
    'sashi511@gmail.com','tamilkrishna.info@gmail.com'
  )
order by lower(member.display_name);
