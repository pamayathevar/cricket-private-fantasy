-- Retire the Unique Player Driven test league without destroying its setup.
-- Archived leagues are hidden from the app's league selector.
begin;

do $$
declare
  v_target_count integer;
begin
  select count(*) into v_target_count
  from public.leagues
  where slug = 'ipl-2026-unique-test';

  if v_target_count <> 1 then
    raise exception 'Expected exactly one league with slug ipl-2026-unique-test; found %', v_target_count;
  end if;
end;
$$;

update public.leagues
set status = 'archived',
    updated_at = now()
where slug = 'ipl-2026-unique-test';

commit;

select
  name,
  slug,
  status,
  case when status = 'archived' then 'PASS' else 'FAIL' end as archive_status
from public.leagues
where slug = 'ipl-2026-unique-test';
