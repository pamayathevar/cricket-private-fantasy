-- Reconcile a league's fixture lifecycle when an active member opens or
-- refreshes the app. The transition is deliberately limited to
-- scheduled -> live at lineup_lock_at. Score publication remains the only
-- normal path to completed, so the app never guesses a result.
begin;

create or replace function public.reconcile_due_fixture_lifecycle(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture record;
  v_materialized jsonb;
  v_advanced integer := 0;
  v_locked_lineups integer := 0;
  v_just_locked integer := 0;
  v_created_lineups integer := 0;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'Active league membership required';
  end if;

  for v_fixture in
    select fixture.id, fixture.league_id, fixture.match_number,
           fixture.lineup_lock_at
    from public.fixtures fixture
    where fixture.league_id = p_league_id
      and fixture.status = 'scheduled'
      and fixture.lineup_lock_at <= clock_timestamp()
    order by fixture.lineup_lock_at, fixture.id
    for update of fixture skip locked
  loop
    -- Migration 073 is idempotent and never overwrites an existing draft or
    -- submitted XI. Missing owners receive the last eligible valid XI with no
    -- booster and no transfer charge.
    v_materialized := public.materialize_locked_fixture_lineups(v_fixture.id);
    v_created_lineups := v_created_lineups
      + coalesce((v_materialized ->> 'created_from_carry_forward')::integer, 0);

    update public.lineup_submissions lineup
    set status = 'locked',
        locked_at = coalesce(lineup.locked_at, v_fixture.lineup_lock_at),
        updated_at = clock_timestamp()
    where lineup.fixture_id = v_fixture.id
      and lineup.status = 'submitted';
    get diagnostics v_just_locked = row_count;
    v_locked_lineups := v_locked_lineups + v_just_locked;

    update public.fixtures fixture
    set status = 'live',
        updated_at = clock_timestamp()
    where fixture.id = v_fixture.id
      and fixture.status = 'scheduled';

    if found then
      v_advanced := v_advanced + 1;
      insert into public.audit_events (
        league_id, actor_user_id, action, entity_type, entity_id, after_data
      ) values (
        v_fixture.league_id,
        auth.uid(),
        'fixture_advanced_at_lock',
        'fixture',
        v_fixture.id::text,
        jsonb_build_object(
          'match_number', v_fixture.match_number,
          'previous_status', 'scheduled',
          'status', 'live',
          'lineup_lock_at', v_fixture.lineup_lock_at,
          'materialization', v_materialized
        )
      );
    end if;
  end loop;

  return jsonb_build_object(
    'fixtures_advanced', v_advanced,
    'submitted_lineups_locked', v_locked_lineups,
    'carry_forward_lineups_created', v_created_lineups
  );
end;
$$;

revoke all on function public.reconcile_due_fixture_lifecycle(uuid)
  from public, anon;
grant execute on function public.reconcile_due_fixture_lifecycle(uuid)
  to authenticated;

commit;
