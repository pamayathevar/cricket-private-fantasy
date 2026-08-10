-- Seed the confirmed Phase 1 Marquee Players for the IPL 2026 Royalty test league.
-- This is intentionally limited to the test league and is safe to run repeatedly.
begin;

create temporary table desired_phase1_marquee_players (
  owner_email text not null,
  owner_name text not null,
  player_name text not null,
  primary key (owner_email, player_name)
) on commit drop;

insert into desired_phase1_marquee_players (owner_email, owner_name, player_name) values
  ('baluinfo@gmail.com', 'Bala', 'Shivam Dube'),
  ('baluinfo@gmail.com', 'Bala', 'Ishan Kishan'),
  ('jebarajsam@gmail.com', 'Jeba', 'Ruturaj Gaikwad'),
  ('jebarajsam@gmail.com', 'Jeba', 'Aiden Markram'),
  ('johnyamarnath@gmail.com', 'Johny', 'Jos Buttler'),
  ('johnyamarnath@gmail.com', 'Johny', 'Yashasvi Jaiswal'),
  ('osa.mansurahamad@gmail.com', 'Mansur', 'Shubman Gill'),
  ('osa.mansurahamad@gmail.com', 'Mansur', 'Shimron Hetmyer'),
  ('muralikg24@gmail.com', 'Murali', 'Sanju Samson'),
  ('muralikg24@gmail.com', 'Murali', 'Suryakumar Yadav'),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 'Mitchell Marsh'),
  ('pandiyan.mayathevar@gmail.com', 'Pandiyan', 'Abhishek Sharma'),
  ('saransamy@gmail.com', 'Saravana', 'Sai Sudharsan'),
  ('saransamy@gmail.com', 'Saravana', 'Hardik Pandya'),
  ('sashi511@gmail.com', 'Sashi', 'Axar Patel'),
  ('sashi511@gmail.com', 'Sashi', 'Rashid Khan'),
  ('tamilkrishna.info@gmail.com', 'Tamil', 'Virat Kohli'),
  ('tamilkrishna.info@gmail.com', 'Tamil', 'Vaibhav Sooryavanshi');

do $$
declare
  v_league_id uuid;
  v_phase_id uuid;
  v_rule_set_id uuid;
  v_problem text;
begin
  select id into v_league_id
  from public.leagues
  where slug = 'ipl-2026-royalty-test';
  if v_league_id is null then
    raise exception 'League ipl-2026-royalty-test does not exist';
  end if;

  select id into v_phase_id
  from public.league_phases
  where league_id = v_league_id and active and sort_order = 1;
  if v_phase_id is null then
    raise exception 'Active Phase 1 does not exist for IPL 2026 Royalty Driven';
  end if;

  select id into v_rule_set_id
  from public.special_player_rules_for_match(v_league_id, 1)
  where marquee_mode_enabled;
  if v_rule_set_id is null then
    raise exception 'Royalty/Marquee mode is not enabled for Match 1';
  end if;

  select string_agg(source.owner_name || ' <' || source.owner_email || '>', ', ')
    into v_problem
  from desired_phase1_marquee_players source
  left join public.league_members member
    on member.league_id = v_league_id
   and lower(member.email) = lower(source.owner_email)
   and member.status = 'active'
  where member.id is null;
  if v_problem is not null then
    raise exception 'Active league owners not found: %', v_problem;
  end if;

  select string_agg(problem.assignment, ', ')
    into v_problem
  from (
    select source.owner_name || ' -> ' || source.player_name as assignment
    from desired_phase1_marquee_players source
    join public.league_members member
      on member.league_id = v_league_id
     and lower(member.email) = lower(source.owner_email)
     and member.status = 'active'
    left join public.league_players league_player
      on league_player.league_id = v_league_id
     and league_player.owner_member_id = member.id
     and league_player.active
    left join public.players player
      on player.id = league_player.player_id
     and lower(trim(player.full_name)) = lower(trim(source.player_name))
    group by source.owner_email, source.owner_name, source.player_name
    having count(player.id) <> 1
  ) problem;
  if v_problem is not null then
    raise exception 'Player missing, inactive, duplicated, or not owned by the stated owner: %', v_problem;
  end if;

  if exists (
    select 1
    from desired_phase1_marquee_players
    group by owner_email
    having count(*) <> 2
  ) then
    raise exception 'Every owner must have exactly two Phase 1 Marquee Players';
  end if;
end;
$$;

-- This seed represents the owners' confirmed pre-league choices. Bypass only
-- the date-window trigger; all ownership and mode checks above remain strict.
alter table public.phase_special_players
  disable trigger enforce_phase_special_selection_window_before_write;

delete from public.phase_special_players selection
using public.league_members member, public.leagues league
where league.slug = 'ipl-2026-royalty-test'
  and member.league_id = league.id
  and selection.league_id = league.id
  and selection.member_id = member.id
  and selection.phase_id = (
    select phase.id from public.league_phases phase
    where phase.league_id = league.id and phase.active and phase.sort_order = 1
  )
  and selection.selection_type = 'marquee'
  and lower(member.email) in (
    select lower(source.owner_email) from desired_phase1_marquee_players source
  );

insert into public.phase_special_players (
  league_id, phase_id, member_id, player_id, selection_type, rule_set_id,
  selected_by, selected_at
)
select
  league.id,
  phase.id,
  member.id,
  player.id,
  'marquee',
  rules.id,
  null,
  now()
from desired_phase1_marquee_players source
join public.leagues league on league.slug = 'ipl-2026-royalty-test'
join public.league_phases phase
  on phase.league_id = league.id and phase.active and phase.sort_order = 1
join public.league_members member
  on member.league_id = league.id
 and lower(member.email) = lower(source.owner_email)
 and member.status = 'active'
join public.league_players league_player
  on league_player.league_id = league.id
 and league_player.owner_member_id = member.id
 and league_player.active
join public.players player
  on player.id = league_player.player_id
 and lower(trim(player.full_name)) = lower(trim(source.player_name))
join lateral public.special_player_rules_for_match(league.id, 1) rules
  on rules.marquee_mode_enabled;

alter table public.phase_special_players
  enable trigger enforce_phase_special_selection_window_before_write;

commit;

-- Verification: returns 18 PASS rows when every assignment is correct.
select
  member.display_name,
  player.full_name as marquee_player,
  phase.name as phase_name,
  case
    when league_player.owner_member_id = selection.member_id then 'PASS'
    else 'FAIL'
  end as ownership_status
from public.phase_special_players selection
join public.leagues league on league.id = selection.league_id
join public.league_phases phase on phase.id = selection.phase_id
join public.league_members member on member.id = selection.member_id
join public.players player on player.id = selection.player_id
join public.league_players league_player
  on league_player.league_id = selection.league_id
 and league_player.player_id = selection.player_id
where league.slug = 'ipl-2026-royalty-test'
  and phase.sort_order = 1
  and selection.selection_type = 'marquee'
order by lower(member.display_name), player.full_name;
