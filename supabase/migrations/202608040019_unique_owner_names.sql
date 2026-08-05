-- Prevent duplicate owner/admin display names inside one league.
begin;

do $$
declare
  v_duplicates text;
begin
  select string_agg(format('%s (%s records)', duplicate.display_name, duplicate.record_count), ', ' order by duplicate.display_name)
  into v_duplicates
  from (
    select min(trim(member.display_name)) as display_name, count(*) as record_count
    from public.league_members member
    where member.role in ('league_admin', 'owner')
    group by member.league_id, lower(trim(member.display_name))
    having count(*) > 1
  ) duplicate;

  if v_duplicates is not null then
    raise exception 'Duplicate owner names must be resolved before migration 019: %', v_duplicates;
  end if;
end;
$$;

create unique index league_members_unique_owner_name_ci
  on public.league_members (league_id, lower(trim(display_name)))
  where role in ('league_admin', 'owner');

create or replace function public.validate_unique_owner_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.display_name := trim(new.display_name);
  if nullif(new.display_name, '') is null then raise exception 'Owner display name is required'; end if;
  if new.role in ('league_admin', 'owner') and exists (
    select 1 from public.league_members existing
    where existing.league_id = new.league_id
      and existing.id <> new.id
      and existing.role in ('league_admin', 'owner')
      and lower(trim(existing.display_name)) = lower(new.display_name)
  ) then
    raise exception 'Owner name "%" is already used in this league', new.display_name;
  end if;
  return new;
end;
$$;

create trigger validate_unique_owner_name_before_write
before insert or update of league_id, display_name, role on public.league_members
for each row execute function public.validate_unique_owner_name();

commit;
