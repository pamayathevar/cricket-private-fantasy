-- Read-only duplicate-name preflight and migration 019 verification.
select member.league_id, lower(trim(member.display_name)) as normalized_owner_name,
  string_agg(member.display_name || ' <' || member.email::text || '>', ', ' order by member.email::text) as records,
  count(*) as record_count
from public.league_members member
where member.role in ('league_admin', 'owner')
group by member.league_id, lower(trim(member.display_name))
having count(*) > 1
order by normalized_owner_name;

select
  to_regclass('public.league_members_unique_owner_name_ci') is not null as unique_index_installed,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.league_members'::regclass
      and tgname = 'validate_unique_owner_name_before_write'
      and not tgisinternal
  ) as validation_trigger_installed;
