-- Captain, Vice-Captain, BAI and BOI are optional for every lineup.
begin;

alter table public.lineup_submissions
  alter column captain_player_id drop not null,
  alter column vice_captain_player_id drop not null;

comment on column public.lineup_submissions.captain_player_id is
  'Optional Captain marker. Null means the owner skipped Captain for this fixture.';
comment on column public.lineup_submissions.vice_captain_player_id is
  'Optional Vice-Captain marker. Null means the owner skipped Vice-Captain for this fixture.';
comment on column public.lineup_submissions.impact_player_id is
  'Optional BAI/BOI player. Impact player and impact_type must either both be null or both be supplied.';

commit;
