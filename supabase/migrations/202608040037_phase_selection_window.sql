-- Open only the next phase's Unique/Marquee selection window.
-- Phase 1 is available before the league begins. A later phase opens only
-- when the preceding phase's first match starts and closes at its own deadline.
begin;

create or replace function public.phase_special_selection_opens_at(p_phase_id uuid)
returns timestamptz
language sql
stable
security invoker
set search_path = public
as $$
  select previous_fixture.scheduled_start
  from public.league_phases phase
  left join public.league_phases previous_phase
    on previous_phase.league_id = phase.league_id
   and previous_phase.active
   and previous_phase.sort_order = phase.sort_order - 1
  left join lateral (
    select min(fixture.scheduled_start) as scheduled_start
    from public.fixtures fixture
    where fixture.phase_id = previous_phase.id
  ) previous_fixture on true
  where phase.id = p_phase_id
$$;

create or replace function public.enforce_phase_special_selection_window()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_phase public.league_phases%rowtype;
  v_opens_at timestamptz;
  v_deadline timestamptz;
begin
  select * into v_phase from public.league_phases
  where id = case when tg_op = 'DELETE' then old.phase_id else new.phase_id end and active;
  if not found then raise exception 'Active league phase not found'; end if;
  if v_phase.is_final_phase then
    raise exception 'Unique and Marquee selections cannot be changed for the final phase';
  end if;
  select public.phase_special_selection_opens_at(v_phase.id),
         public.phase_special_selection_deadline(v_phase.id)
    into v_opens_at, v_deadline;
  if v_opens_at is not null and now() < v_opens_at then
    raise exception '% selection opens when the previous phase starts at %', v_phase.name, v_opens_at;
  end if;
  if v_deadline is null then raise exception 'The phase must have fixtures before player selections can be changed'; end if;
  if now() >= v_deadline then raise exception '% selection closed at %', v_phase.name, v_deadline; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists enforce_phase_special_selection_window_before_write
  on public.phase_special_players;
create trigger enforce_phase_special_selection_window_before_write
before insert or update or delete on public.phase_special_players
for each row execute function public.enforce_phase_special_selection_window();

grant execute on function public.phase_special_selection_opens_at(uuid) to authenticated;

commit;
