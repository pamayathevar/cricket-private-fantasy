-- Run after 202608040048_sync_ipl2026_official_squads.sql.
-- Expected: every team in every IPL 2026 league is PASS.
with expected(team_code, official_players, active_players, withdrawn_players) as (
  values
    ('CSK', 30, 25, 5), ('DC', 26, 25, 1), ('GT', 27, 25, 2),
    ('KKR', 29, 24, 5), ('LSG', 26, 25, 1), ('MI', 29, 25, 4),
    ('PBKS', 25, 25, 0), ('RCB', 26, 24, 2), ('RR', 27, 25, 2),
    ('SRH', 29, 25, 4)
),
target_leagues as (
  select id, name
  from public.leagues
  where competition = 'Indian Premier League'
    and season_year = 2026
),
actual as (
  select
    league.id as league_id,
    league.name as league_name,
    team.code as team_code,
    count(*) as total_players,
    count(*) filter (where league_player.active) as active_players
  from target_leagues league
  join public.league_players league_player on league_player.league_id = league.id
  join public.players player on player.id = league_player.player_id
  join public.cricket_teams team on team.id = player.team_id
  group by league.id, league.name, team.code
),
withdrawn(team_code, full_name) as (
  values
    ('CSK', 'Ayush Mhatre'), ('CSK', 'Ramakrishna Ghosh'),
    ('CSK', 'Jamie Overton'), ('CSK', 'Khaleel Ahmed'),
    ('CSK', 'Nathan Ellis'), ('DC', 'Ben Duckett'),
    ('GT', 'Tom Banton'), ('GT', 'Prithvi Raj'),
    ('KKR', 'Rachin Ravindra'), ('KKR', 'Akash Deep'),
    ('KKR', 'Harshit Rana'), ('KKR', 'Mustafizur Rahman'),
    ('KKR', 'Matheesha Pathirana'), ('LSG', 'Wanindu Hasaranga'),
    ('MI', 'Quinton de Kock'), ('MI', 'Atharva Ankolekar'),
    ('MI', 'Raj Bawa'), ('MI', 'Mitchell Santner'),
    ('RCB', 'Nuwan Thushara'), ('RCB', 'Yash Dayal'),
    ('RR', 'Ravi Singh'), ('RR', 'Sam Curran'),
    ('SRH', 'Brydon Carse'), ('SRH', 'Jack Edwards'),
    ('SRH', 'Shivam Mavi'), ('SRH', 'David Payne')
),
inactive_withdrawn as (
  select
    league.id as league_id,
    withdrawn.team_code,
    count(*) filter (where not league_player.active) as inactive_players
  from target_leagues league
  cross join withdrawn
  left join public.cricket_teams team on team.code = withdrawn.team_code
  left join public.players player
    on player.team_id = team.id
   and lower(trim(replace(player.full_name, chr(160), ' '))) =
       lower(trim(replace(withdrawn.full_name, chr(160), ' ')))
  left join public.league_players league_player
    on league_player.league_id = league.id
   and league_player.player_id = player.id
  group by league.id, withdrawn.team_code
)
select
  league.name as league_name,
  expected.team_code,
  coalesce(actual.total_players, 0) as total_players,
  expected.official_players as expected_total,
  coalesce(actual.active_players, 0) as active_players,
  expected.active_players as expected_active,
  coalesce(inactive.inactive_players, 0) as inactive_withdrawn,
  expected.withdrawn_players as expected_withdrawn,
  case
    when coalesce(actual.total_players, 0) = expected.official_players
     and coalesce(actual.active_players, 0) = expected.active_players
     and coalesce(inactive.inactive_players, 0) = expected.withdrawn_players
    then 'PASS'
    else 'FAIL'
  end as status
from target_leagues league
cross join expected
left join actual
  on actual.league_id = league.id
 and actual.team_code = expected.team_code
left join inactive_withdrawn inactive
  on inactive.league_id = league.id
 and inactive.team_code = expected.team_code
order by league.name, expected.team_code;

-- The six newly imported players must initially be active OpenPlayers.
with replacements(team_code, full_name, expected_role) as (
  values
    ('DC', 'Rehan Ahmed', 'AL'),
    ('KKR', 'Luvnith Sisodia', 'WK'),
    ('MI', 'Ruchit Ahir', 'BA'),
    ('MI', 'Mahipal Lomror', 'AL'),
    ('RR', 'Emanjot Singh Chahal', 'AL'),
    ('SRH', 'Gerald Coetzee', 'BO')
)
select
  league.name as league_name,
  replacement.team_code,
  replacement.full_name,
  player.role,
  league_player.acquisition_price as selection_cost,
  coalesce(member.display_name, 'OpenPlayer') as assigned_owner,
  case
    when league_player.active
     and league_player.owner_member_id is null
     and player.role = replacement.expected_role
     and league_player.acquisition_price > 0
    then 'PASS'
    else 'FAIL'
  end as status
from public.leagues league
cross join replacements replacement
join public.cricket_teams team on team.code = replacement.team_code
join public.players player
  on player.team_id = team.id
 and lower(trim(player.full_name)) = lower(trim(replacement.full_name))
join public.league_players league_player
  on league_player.league_id = league.id
 and league_player.player_id = player.id
left join public.league_members member on member.id = league_player.owner_member_id
where league.competition = 'Indian Premier League'
  and league.season_year = 2026
order by league.name, replacement.team_code, replacement.full_name;
