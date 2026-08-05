-- Run before staging Match 2 points.
-- Every scorecard participant must resolve to exactly one active IPL 2026 player.
with source_players(source_name, database_name, team_code) as (
  values
    ('Ajinkya Rahane', 'Ajinkya Rahane', 'KKR'),
    ('Finn Allen', 'Finn Allen', 'KKR'),
    ('Cameron Green', 'Cameron Green', 'KKR'),
    ('Angkrish Raghuvanshi', 'Angkrish Raghuvanshi', 'KKR'),
    ('Rinku Singh', 'Rinku Singh', 'KKR'),
    ('Ramandeep Singh', 'Ramandeep Singh', 'KKR'),
    ('Anukul Roy', 'Anukul Roy', 'KKR'),
    ('Sunil Narine', 'Sunil Narine', 'KKR'),
    ('Varun Chakaravarthy', 'Varun Chakravarthy', 'KKR'),
    ('Vaibhav Arora', 'Vaibhav Arora', 'KKR'),
    ('Blessing Muzarabani', 'Blessing Muzarabani', 'KKR'),
    ('Kartik Tyagi', 'Kartik Tyagi', 'KKR'),
    ('Manish Pandey', 'Manish Pandey', 'KKR'),
    ('Ryan Rickelton', 'Ryan Rickelton', 'MI'),
    ('Rohit Sharma', 'Rohit Sharma', 'MI'),
    ('Suryakumar Yadav', 'Suryakumar Yadav', 'MI'),
    ('Tilak Varma', 'Tilak Varma', 'MI'),
    ('Hardik Pandya', 'Hardik Pandya', 'MI'),
    ('Naman Dhir', 'Naman Dhir', 'MI'),
    ('Sherfane Rutherford', 'Sherfane Rutherford', 'MI'),
    ('Shardul Thakur', 'Shardul Thakur', 'MI'),
    ('Mayank Markande', 'Mayank Markande', 'MI'),
    ('Allah Mohammad Ghazanfar', 'AM Ghazanfar', 'MI'),
    ('Trent Boult', 'Trent Boult', 'MI'),
    ('Jasprit Bumrah', 'Jasprit Bumrah', 'MI')
), resolved as (
  select
    source.source_name,
    source.team_code,
    player.id as player_id,
    player.full_name as database_name,
    league_player.active
  from source_players source
  left join public.cricket_teams team on team.code = source.team_code
  left join public.players player
    on player.team_id = team.id
   and player.full_name = source.database_name
  left join public.league_players league_player
    on league_player.player_id = player.id
   and league_player.league_id = '10000000-0000-4000-8000-000000002026'
)
select
  source_name,
  team_code,
  database_name,
  case
    when player_id is null then 'MISSING'
    when active is distinct from true then 'INACTIVE'
    else 'OK'
  end as status
from resolved
order by status desc, team_code, source_name;
