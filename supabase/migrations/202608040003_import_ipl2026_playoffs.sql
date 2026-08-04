-- Adds the four IPL 2026 playoff fixtures omitted from the league-stage import.
-- All timestamps are 7:30 PM Asia/Kolkata (14:00 UTC).
begin;

create temporary table incoming_ipl2026_playoffs (
  match_number integer not null,
  external_ref text not null,
  stage text not null,
  team1_code text not null,
  team2_code text not null,
  scheduled_start timestamptz not null,
  venue text not null
) on commit drop;

insert into incoming_ipl2026_playoffs
  (match_number, external_ref, stage, team1_code, team2_code, scheduled_start, venue)
values
  (71, 'ipl-2026-qualifier-1', 'playoff', 'RCB', 'GT',  '2026-05-26 14:00:00+00', 'HPCA Stadium, Dharamshala'),
  (72, 'ipl-2026-eliminator',  'playoff', 'SRH', 'RR',  '2026-05-27 14:00:00+00', 'Maharaja Yadavindra Singh International Cricket Stadium, New Chandigarh'),
  (73, 'ipl-2026-qualifier-2', 'playoff', 'GT',  'RR',  '2026-05-29 14:00:00+00', 'Maharaja Yadavindra Singh International Cricket Stadium, New Chandigarh'),
  (74, 'ipl-2026-final',       'final',   'RCB', 'GT',  '2026-05-31 14:00:00+00', 'Narendra Modi Stadium, Ahmedabad');

do $$
begin
  if (select count(*) from incoming_ipl2026_playoffs) <> 4 then
    raise exception 'Expected four IPL 2026 playoff fixtures';
  end if;

  if exists (
    select 1
    from incoming_ipl2026_playoffs i
    left join public.cricket_teams team1 on team1.code = i.team1_code
    left join public.cricket_teams team2 on team2.code = i.team2_code
    where team1.id is null or team2.id is null
  ) then
    raise exception 'One or more playoff teams do not exist';
  end if;
end $$;

insert into public.fixtures (
  league_id, external_ref, match_number, stage,
  home_team_id, away_team_id, scheduled_start, lineup_lock_at,
  venue, status, scoring_status, scorecard_source_url
)
select
  '10000000-0000-4000-8000-000000002026',
  i.external_ref,
  i.match_number,
  i.stage,
  team1.id,
  team2.id,
  i.scheduled_start,
  i.scheduled_start,
  i.venue,
  'scheduled',
  'pending',
  'https://www.iplt20.com/matches/playoffs'
from incoming_ipl2026_playoffs i
join public.cricket_teams team1 on team1.code = i.team1_code
join public.cricket_teams team2 on team2.code = i.team2_code
on conflict (league_id, match_number) do update
set external_ref = excluded.external_ref,
    stage = excluded.stage,
    home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id,
    scheduled_start = excluded.scheduled_start,
    lineup_lock_at = excluded.lineup_lock_at,
    venue = excluded.venue,
    scorecard_source_url = excluded.scorecard_source_url,
    updated_at = now();

commit;
