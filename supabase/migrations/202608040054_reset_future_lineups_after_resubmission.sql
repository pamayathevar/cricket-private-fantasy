-- Resubmitting an earlier XI invalidates every later unlocked submission. The
-- revised XI then becomes the carry-forward baseline and later matches must be
-- submitted again in order.
begin;

create or replace function public.reset_submitted_future_lineups(
  p_league_id uuid,
  p_member_id uuid,
  p_changed_match_number integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_locked_future_match integer;
  v_reset_lineup_ids uuid[];
  v_reset_match_numbers integer[];
  v_reset_count integer := 0;
begin
  select fixture.match_number into v_locked_future_match
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.league_id = p_league_id
    and lineup.member_id = p_member_id
    and lineup.status in ('submitted', 'locked')
    and fixture.match_number > p_changed_match_number
    and (
      lineup.status = 'locked'
      or fixture.status <> 'scheduled'
      or now() >= coalesce(fixture.lineup_lock_at, fixture.scheduled_start)
    )
  order by fixture.match_number
  limit 1;

  if v_locked_future_match is not null then
    raise exception 'Match % cannot be changed because the submitted Match % lineup is already locked',
      p_changed_match_number, v_locked_future_match;
  end if;

  select
    array_agg(lineup.id order by fixture.match_number),
    array_agg(fixture.match_number order by fixture.match_number)
    into v_reset_lineup_ids, v_reset_match_numbers
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.league_id = p_league_id
    and lineup.member_id = p_member_id
    and lineup.status = 'submitted'
    and fixture.status = 'scheduled'
    and now() < coalesce(fixture.lineup_lock_at, fixture.scheduled_start)
    and fixture.match_number > p_changed_match_number;

  v_reset_count := coalesce(cardinality(v_reset_lineup_ids), 0);
  if v_reset_count = 0 then return 0; end if;

  delete from public.transfer_events event
  using public.fixtures fixture
  where fixture.id = event.fixture_id
    and event.league_id = p_league_id
    and event.member_id = p_member_id
    and event.reason = 'lineup_change'
    and fixture.match_number > p_changed_match_number;

  delete from public.lineup_submissions lineup
  where lineup.id = any(v_reset_lineup_ids);

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_league_id, auth.uid(), 'future_lineups_reset_after_resubmission',
    'lineup_submission', p_member_id::text,
    jsonb_build_object(
      'lineup_ids', to_jsonb(v_reset_lineup_ids),
      'match_numbers', to_jsonb(v_reset_match_numbers)
    ),
    jsonb_build_object(
      'changed_match_number', p_changed_match_number,
      'reset_count', v_reset_count,
      'carry_forward_from_match', p_changed_match_number
    )
  );

  return v_reset_count;
end;
$$;

revoke all on function public.reset_submitted_future_lineups(uuid, uuid, integer) from public;

do $$
declare
  v_definition text;
  v_old_usage text := $old$select coalesce(sum(transfer_count), 0) into v_used from public.transfer_events
  where league_id = v_fixture.league_id and member_id = v_member_id
    and transfer_period_id = v_period.id and reason = 'lineup_change'
    and fixture_id is distinct from p_fixture_id;$old$;
  v_new_usage text := $new$select coalesce(sum(event.transfer_count), 0) into v_used
  from public.transfer_events event
  join public.fixtures used_fixture on used_fixture.id = event.fixture_id
  where event.league_id = v_fixture.league_id and event.member_id = v_member_id
    and event.transfer_period_id = v_period.id and event.reason = 'lineup_change'
    and used_fixture.match_number < v_fixture.match_number;$new$;
  v_old_call text := $old$  perform public.recalculate_next_submitted_lineup_transfers(
    v_fixture.league_id, v_member_id, v_fixture.match_number
  );$old$;
  v_new_call text := $new$  perform public.reset_submitted_future_lineups(
    v_fixture.league_id, v_member_id, v_fixture.match_number
  );$new$;
  v_audit_anchor text := $anchor$  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)$anchor$;
  v_audit_with_reset text := $replacement$  perform public.reset_submitted_future_lineups(
    v_fixture.league_id, v_member_id, v_fixture.match_number
  );

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)$replacement$;
begin
  v_definition := pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  );

  if position(v_old_usage in v_definition) > 0 then
    v_definition := replace(v_definition, v_old_usage, v_new_usage);
  elsif position('used_fixture.match_number < v_fixture.match_number' in v_definition) = 0 then
    raise exception 'Could not locate transfer usage calculation';
  end if;

  if position(v_old_call in v_definition) > 0 then
    v_definition := replace(v_definition, v_old_call, v_new_call);
  elsif position('reset_submitted_future_lineups' in v_definition) = 0 then
    if position(v_audit_anchor in v_definition) = 0 then
      raise exception 'Could not locate lineup transfer audit insertion';
    end if;
    v_definition := replace(v_definition, v_audit_anchor, v_audit_with_reset);
  end if;

  execute v_definition;
end;
$$;

drop function if exists public.recalculate_next_submitted_lineup_transfers(uuid, uuid, integer);

commit;
