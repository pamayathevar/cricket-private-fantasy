-- Harshal Patel is classified as a bowler for SRH in the IPL 2026 player data.
update public.players player
set role = 'BO',
    updated_at = now()
from public.cricket_teams team
where player.team_id = team.id
  and team.code = 'SRH'
  and player.full_name = 'Harshal Patel'
  and player.role is distinct from 'BO';
