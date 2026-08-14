-- Keep the populated Royalty Driven league as the single visible IPL 2026
-- league. Archive the two superseded variants without deleting their history.
begin;

do $$
declare
  v_target_count integer;
begin
  select count(*)
  into v_target_count
  from public.leagues
  where slug in (
    'ipl-2026',
    'ipl-2026-open-test',
    'ipl-2026-royalty-test'
  );

  if v_target_count <> 3 then
    raise exception
      'Expected the standard, Open Players, and Royalty Driven IPL 2026 leagues; found %',
      v_target_count;
  end if;
end;
$$;

create temporary table league_selector_changes on commit drop as
select
  league.id as league_id,
  league.name as previous_name,
  league.status as previous_status,
  case
    when league.slug = 'ipl-2026-royalty-test' then 'IPL 2026'
    else league.name
  end as next_name,
  case
    when league.slug = 'ipl-2026-royalty-test' then 'active'
    else 'archived'
  end as next_status
from public.leagues league
where league.slug in (
  'ipl-2026',
  'ipl-2026-open-test',
  'ipl-2026-royalty-test'
)
and (
  league.name,
  league.status
) is distinct from (
  case
    when league.slug = 'ipl-2026-royalty-test' then 'IPL 2026'
    else league.name
  end,
  case
    when league.slug = 'ipl-2026-royalty-test' then 'active'
    else 'archived'
  end
);

insert into public.audit_events (
  league_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data
)
select
  change.league_id,
  null,
  'league_selector_consolidated',
  'league',
  change.league_id::text,
  jsonb_build_object(
    'name', change.previous_name,
    'status', change.previous_status
  ),
  jsonb_build_object(
    'name', change.next_name,
    'status', change.next_status,
    'history_preserved', true
  )
from league_selector_changes change;

update public.leagues league
set
  name = change.next_name,
  status = change.next_status,
  updated_at = now()
from league_selector_changes change
where league.id = change.league_id;

commit;
