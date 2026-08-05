-- Safe League Admin publishing for configurable phase names and match ranges.
begin;

alter table public.league_phases
  drop constraint if exists league_phases_league_id_sort_order_key;
create unique index if not exists one_active_phase_sort_order_per_league
  on public.league_phases (league_id, sort_order) where active;

create or replace function public.publish_league_phases(p_league_id uuid, p_phases jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase jsonb;
begin
  if not public.is_league_admin(p_league_id) then raise exception 'League admin access required'; end if;
  if jsonb_typeof(p_phases) is distinct from 'array' or jsonb_array_length(p_phases) = 0 then raise exception 'At least one phase is required'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_phases) phase
    where nullif(trim(phase ->> 'code'), '') is null
       or nullif(trim(phase ->> 'name'), '') is null
       or (phase ->> 'sort_order')::integer < 1
       or (phase ->> 'start_match_number')::integer < 1
       or (phase ->> 'end_match_number')::integer < (phase ->> 'start_match_number')::integer
  ) then raise exception 'Invalid phase name, order or match range'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_phases) phase
    group by phase ->> 'code' having count(*) > 1
  ) then raise exception 'Phase codes must be unique'; end if;
  if exists (
    select 1
    from jsonb_array_elements(p_phases) with ordinality first_phase(value, position)
    join jsonb_array_elements(p_phases) with ordinality second_phase(value, position)
      on first_phase.position < second_phase.position
     and int4range((first_phase.value ->> 'start_match_number')::integer, (first_phase.value ->> 'end_match_number')::integer, '[]')
         && int4range((second_phase.value ->> 'start_match_number')::integer, (second_phase.value ->> 'end_match_number')::integer, '[]')
  ) then raise exception 'Phase match ranges cannot overlap'; end if;
  if exists (
    select 1 from public.fixtures fixture
    where fixture.league_id = p_league_id
      and not exists (
        select 1 from jsonb_array_elements(p_phases) phase
        where fixture.match_number between (phase ->> 'start_match_number')::integer and (phase ->> 'end_match_number')::integer
      )
  ) then raise exception 'Every existing fixture must be covered by a phase'; end if;

  update public.league_phases set active = false, updated_at = now()
  where league_id = p_league_id and active;

  for v_phase in select value from jsonb_array_elements(p_phases)
  loop
    insert into public.league_phases (
      league_id, code, name, sort_order, start_match_number, end_match_number, active
    ) values (
      p_league_id, trim(v_phase ->> 'code'), trim(v_phase ->> 'name'),
      (v_phase ->> 'sort_order')::integer,
      (v_phase ->> 'start_match_number')::integer,
      (v_phase ->> 'end_match_number')::integer, true
    )
    on conflict (league_id, code) do update
    set name = excluded.name, sort_order = excluded.sort_order,
        start_match_number = excluded.start_match_number,
        end_match_number = excluded.end_match_number,
        active = true, updated_at = now();
  end loop;

  update public.fixtures fixture
  set phase_id = phase.id, updated_at = now()
  from public.league_phases phase
  where fixture.league_id = p_league_id
    and phase.league_id = p_league_id and phase.active
    and fixture.match_number between phase.start_match_number and phase.end_match_number;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (p_league_id, auth.uid(), 'league_phases_published', 'league', p_league_id::text,
          jsonb_build_object('phases', p_phases));
end;
$$;

revoke all on function public.publish_league_phases(uuid, jsonb) from public;
grant execute on function public.publish_league_phases(uuid, jsonb) to authenticated;

commit;
