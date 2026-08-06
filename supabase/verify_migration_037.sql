select
  to_regprocedure('public.phase_special_selection_opens_at(uuid)') is not null as opening_function_installed,
  exists (
    select 1 from pg_trigger
    where tgname = 'enforce_phase_special_selection_window_before_write'
      and not tgisinternal
  ) as phase_window_enforced;

select
  league.name as league_name,
  phase.name as phase_name,
  phase.sort_order,
  phase.is_final_phase,
  public.phase_special_selection_opens_at(phase.id) as opens_at,
  public.phase_special_selection_deadline(phase.id) as closes_at
from public.league_phases phase
join public.leagues league on league.id = phase.league_id
where league.slug = 'special-rules-test-2028' and phase.active
order by phase.sort_order;
