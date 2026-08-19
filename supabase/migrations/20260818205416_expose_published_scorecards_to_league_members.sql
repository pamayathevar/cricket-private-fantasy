-- Published scorecard artifacts contain match facts only and are required by
-- the Results screen. Draft and staged review artifacts remain admin-only.
begin;

drop policy if exists score_ingestion_batches_published_member_select
  on public.score_ingestion_batches;
create policy score_ingestion_batches_published_member_select
on public.score_ingestion_batches
for select
to authenticated
using (
  status = 'published'
  and (select public.is_league_member(score_ingestion_batches.league_id))
);

revoke all on table public.score_ingestion_batches from anon;
grant select on table public.score_ingestion_batches to authenticated;

commit;
