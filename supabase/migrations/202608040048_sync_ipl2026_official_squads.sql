-- Synchronize all ten IPL 2026 squads with Cricinfo's published squad pages.
-- Source pages were last updated on 13-Nov-2025 or 14-Nov-2025.
--
-- Withdrawn players remain in the database for ownership, lineup and scoring
-- history, but are inactive in every IPL 2026 league and cannot be selected in
-- a future XI. Newly imported players start as OpenPlayers. Existing owner and
-- bid assignments are never rewritten by this migration.
begin;

create temporary table ipl2026_squad_changes (
  team_code text not null,
  full_name text not null,
  role text not null check (role in ('BA', 'BO', 'WK', 'AL')),
  selection_cost numeric(10,2) not null check (selection_cost >= 0),
  cricinfo_player_id text not null,
  withdrawn boolean not null,
  replacement_for text,
  primary key (team_code, full_name)
) on commit drop;

-- Six players are absent from the original 268-player import. The remaining
-- rows are the 26 players explicitly labelled Withdrawn by Cricinfo.
insert into ipl2026_squad_changes (
  team_code, full_name, role, selection_cost, cricinfo_player_id,
  withdrawn, replacement_for
) values
  ('DC', 'Rehan Ahmed', 'AL', 7, '1263691', false, null),
  ('KKR', 'Luvnith Sisodia', 'WK', 7, '1155253', false, 'Matheesha Pathirana'),
  ('MI', 'Ruchit Ahir', 'BA', 7, '1395884', false, 'Raj Bawa'),
  ('MI', 'Mahipal Lomror', 'AL', 7, '853265', false, 'Quinton de Kock'),
  ('RR', 'Emanjot Singh Chahal', 'AL', 7, '1454587', false, 'Ravi Singh'),
  ('SRH', 'Gerald Coetzee', 'BO', 7, '596010', false, 'David Payne'),

  ('CSK', 'Ayush Mhatre', 'BA', 7, '1452455', true, null),
  ('CSK', 'Ramakrishna Ghosh', 'AL', 7, '1339053', true, null),
  ('CSK', 'Jamie Overton', 'AL', 8, '510530', true, null),
  ('CSK', 'Khaleel Ahmed', 'BO', 8, '942645', true, null),
  ('CSK', 'Nathan Ellis', 'BO', 8, '826915', true, null),
  ('DC', 'Ben Duckett', 'WK', 7.5, '521637', true, null),
  ('GT', 'Tom Banton', 'WK', 7.5, '877051', true, null),
  ('GT', 'Prithvi Raj', 'BO', 7, '1121579', true, null),
  ('KKR', 'Rachin Ravindra', 'AL', 8.5, '959767', true, null),
  ('KKR', 'Akash Deep', 'BO', 7.5, '1176959', true, null),
  ('KKR', 'Harshit Rana', 'BO', 8, '1312645', true, null),
  ('KKR', 'Mustafizur Rahman', 'BO', 9, '330902', true, null),
  ('KKR', 'Matheesha Pathirana', 'BO', 8, '1194795', true, null),
  ('LSG', 'Wanindu Hasaranga', 'AL', 8.5, '784379', true, null),
  ('MI', 'Quinton de Kock', 'WK', 9, '379143', true, null),
  ('MI', 'Atharva Ankolekar', 'AL', 7, '1175467', true, null),
  ('MI', 'Raj Bawa', 'AL', 7.5, '1292502', true, null),
  ('MI', 'Mitchell Santner', 'AL', 9, '502714', true, null),
  ('RCB', 'Nuwan Thushara', 'BO', 8, '955235', true, null),
  ('RCB', 'Yash Dayal', 'BO', 7, '1159720', true, null),
  ('RR', 'Ravi Singh', 'BA', 7, '1461577', true, null),
  ('RR', 'Sam Curran', 'AL', 8.5, '662973', true, null),
  ('SRH', 'Brydon Carse', 'AL', 8, '596417', true, null),
  ('SRH', 'Jack Edwards', 'AL', 7, '1088610', true, null),
  ('SRH', 'Shivam Mavi', 'AL', 7, '1079848', true, null),
  ('SRH', 'David Payne', 'BO', 7, '362710', true, null);

create temporary table ipl2026_role_corrections (
  team_code text not null,
  full_name text not null,
  role text not null check (role in ('BA', 'BO', 'WK', 'AL')),
  primary key (team_code, full_name)
) on commit drop;

insert into ipl2026_role_corrections (team_code, full_name, role) values
  ('CSK', 'Matthew Short', 'AL'),
  ('DC', 'Tristan Stubbs', 'WK'),
  ('DC', 'Ben Duckett', 'WK'),
  ('DC', 'Sameer Rizvi', 'AL'),
  ('LSG', 'Mukul Choudhary', 'WK'),
  ('MI', 'Shardul Thakur', 'AL'),
  ('PBKS', 'Mitchell Owen', 'AL'),
  ('SRH', 'Krains Fuletra', 'AL'),
  ('SRH', 'Harshal Patel', 'AL'),
  ('SRH', 'Shivang Kumar', 'AL');

do $$
begin
  if (select count(*) from public.cricket_teams where code in (
    'CSK', 'DC', 'GT', 'KKR', 'LSG', 'MI', 'PBKS', 'RCB', 'RR', 'SRH'
  )) <> 10 then
    raise exception 'One or more IPL cricket teams are missing';
  end if;

  if not exists (
    select 1 from public.leagues
    where competition = 'Indian Premier League' and season_year = 2026
  ) then
    raise exception 'No IPL 2026 leagues were found';
  end if;
end;
$$;

insert into public.players as existing_player (
  external_ref, full_name, team_id, role, active
)
select
  'cricinfo:' || source.cricinfo_player_id,
  source.full_name,
  team.id,
  source.role,
  true
from ipl2026_squad_changes source
join public.cricket_teams team on team.code = source.team_code
on conflict (full_name, team_id) do update
set role = excluded.role,
    external_ref = coalesce(existing_player.external_ref, excluded.external_ref),
    updated_at = now();

update public.players player
set role = correction.role,
    updated_at = now()
from public.cricket_teams team,
     ipl2026_role_corrections correction
where player.team_id = team.id
  and team.code = correction.team_code
  and lower(trim(replace(player.full_name, chr(160), ' '))) =
      lower(trim(replace(correction.full_name, chr(160), ' ')))
  and player.role is distinct from correction.role;

insert into public.league_players (
  league_id, player_id, owner_member_id, acquisition_type,
  acquisition_price, active, acquired_at
)
select
  league.id,
  player.id,
  null,
  'open',
  source.selection_cost,
  true,
  null
from public.leagues league
cross join ipl2026_squad_changes source
join public.cricket_teams team on team.code = source.team_code
join public.players player
  on player.team_id = team.id
 and lower(trim(replace(player.full_name, chr(160), ' '))) =
     lower(trim(replace(source.full_name, chr(160), ' ')))
where league.competition = 'Indian Premier League'
  and league.season_year = 2026
  and not source.withdrawn
on conflict (league_id, player_id) do nothing;

update public.league_players league_player
set active = false,
    released_at = coalesce(league_player.released_at, now()),
    updated_at = now()
from public.leagues league,
     public.players player,
     public.cricket_teams team,
     ipl2026_squad_changes source
where league_player.league_id = league.id
  and league_player.player_id = player.id
  and player.team_id = team.id
  and team.code = source.team_code
  and lower(trim(replace(player.full_name, chr(160), ' '))) =
      lower(trim(replace(source.full_name, chr(160), ' ')))
  and source.withdrawn
  and league.competition = 'Indian Premier League'
  and league.season_year = 2026
  and league_player.active;

create temporary table ipl2026_squad_sources (
  team_code text primary key,
  source_url text not null,
  source_last_updated date not null,
  official_players integer not null,
  active_players integer not null,
  withdrawn_players integer not null
) on commit drop;

insert into ipl2026_squad_sources values
  ('CSK', 'https://www.cricinfo.com/series/ipl-2026-1510719/chennai-super-kings-squad-1511148/series-squads', '2025-11-14', 30, 25, 5),
  ('DC', 'https://www.cricinfo.com/series/ipl-2026-1510719/delhi-capitals-squad-1511107/series-squads', '2025-11-14', 26, 25, 1),
  ('GT', 'https://www.cricinfo.com/series/ipl-2026-1510719/gujarat-titans-squad-1511094/series-squads', '2025-11-13', 27, 25, 2),
  ('KKR', 'https://www.cricinfo.com/series/ipl-2026-1510719/kolkata-knight-riders-squad-1511092/series-squads', '2025-11-13', 29, 24, 5),
  ('LSG', 'https://www.cricinfo.com/series/ipl-2026-1510719/lucknow-super-giants-squad-1511235/series-squads', '2025-11-14', 26, 25, 1),
  ('MI', 'https://www.cricinfo.com/series/ipl-2026-1510719/mumbai-indians-squad-1511109/series-squads', '2025-11-14', 29, 25, 4),
  ('PBKS', 'https://www.cricinfo.com/series/ipl-2026-1510719/punjab-kings-squad-1511082/series-squads', '2025-11-13', 25, 25, 0),
  ('RCB', 'https://www.cricinfo.com/series/ipl-2026-1510719/royal-challengers-bengaluru-squad-1511134/series-squads', '2025-11-14', 26, 24, 2),
  ('RR', 'https://www.cricinfo.com/series/ipl-2026-1510719/rajasthan-royals-squad-1511089/series-squads', '2025-11-13', 27, 25, 2),
  ('SRH', 'https://www.cricinfo.com/series/ipl-2026-1510719/sunrisers-hyderabad-squad-1511114/series-squads', '2025-11-14', 29, 25, 4);

insert into public.audit_events (
  league_id, actor_user_id, action, entity_type, entity_id, after_data
)
select
  league.id,
  null,
  'official_squad_synced',
  'cricket_team',
  source.team_code,
  jsonb_build_object(
    'competition', league.competition,
    'season_year', league.season_year,
    'source', 'Cricinfo',
    'source_url', source.source_url,
    'source_last_updated', source.source_last_updated,
    'official_players', source.official_players,
    'active_players', source.active_players,
    'withdrawn_players_deactivated', source.withdrawn_players
  )
from public.leagues league
cross join ipl2026_squad_sources source
where league.competition = 'Indian Premier League'
  and league.season_year = 2026
  and not exists (
    select 1
    from public.audit_events audit
    where audit.league_id = league.id
      and audit.action = 'official_squad_synced'
      and audit.entity_type = 'cricket_team'
      and audit.entity_id = source.team_code
      and audit.after_data ->> 'source_last_updated' = source.source_last_updated::text
  );

commit;
