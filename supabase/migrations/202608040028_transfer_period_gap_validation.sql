-- Require transfer periods to start at Match 1 and cover matches continuously.
begin;

create or replace function public.publish_league_transfer_periods(
  p_league_id uuid,
  p_periods jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period jsonb;
  v_count integer;
  v_last_fixture_match integer;
begin
  if not public.is_league_admin(p_league_id) then raise exception 'League admin access required'; end if;
  if jsonb_typeof(p_periods) <> 'array' or jsonb_array_length(p_periods) = 0 then
    raise exception 'At least one transfer period is required';
  end if;

  create temporary table transfer_period_input (
    code text primary key, name text, start_match integer, end_match integer,
    transfer_limit integer, first_match_free boolean, sort_order integer
  ) on commit drop;

  for v_period in select value from jsonb_array_elements(p_periods)
  loop
    insert into transfer_period_input values (
      nullif(trim(v_period->>'code'), ''), nullif(trim(v_period->>'name'), ''),
      (v_period->>'start_match_number')::integer, (v_period->>'end_match_number')::integer,
      (v_period->>'transfer_limit')::integer, coalesce((v_period->>'first_match_free')::boolean, true),
      (v_period->>'sort_order')::integer
    );
  end loop;

  if exists (select 1 from transfer_period_input where code is null or name is null
    or start_match < 1 or end_match < start_match or transfer_limit < 0 or sort_order < 1) then
    raise exception 'Every transfer period needs a name, valid match range, and non-negative limit';
  end if;
  if (select min(start_match) from transfer_period_input) <> 1 then
    raise exception 'The first transfer period must start at Match 1';
  end if;
  if exists (
    select 1 from transfer_period_input a join transfer_period_input b
      on a.code < b.code and int4range(a.start_match, a.end_match, '[]') && int4range(b.start_match, b.end_match, '[]')
  ) then raise exception 'Transfer period match ranges cannot overlap'; end if;
  if exists (
    select 1
    from (
      select start_match, lag(end_match) over (order by start_match, sort_order) as previous_end
      from transfer_period_input
    ) ordered
    where previous_end is not null and start_match <> previous_end + 1
  ) then raise exception 'Transfer periods cannot have gaps between match ranges'; end if;

  select max(match_number) into v_last_fixture_match
  from public.fixtures where league_id = p_league_id;
  if v_last_fixture_match is not null
    and (select max(end_match) from transfer_period_input) < v_last_fixture_match then
    raise exception 'Transfer periods must cover every fixture through Match %', v_last_fixture_match;
  end if;

  update public.league_transfer_periods set active = false, updated_at = now()
  where league_id = p_league_id;

  insert into public.league_transfer_periods (
    league_id, code, name, start_match_number, end_match_number, transfer_limit,
    first_match_free, sort_order, active, created_by
  )
  select p_league_id, code, name, start_match, end_match, transfer_limit,
    first_match_free, sort_order, true, auth.uid()
  from transfer_period_input
  on conflict (league_id, code) do update set
    name = excluded.name, start_match_number = excluded.start_match_number,
    end_match_number = excluded.end_match_number, transfer_limit = excluded.transfer_limit,
    first_match_free = excluded.first_match_free, sort_order = excluded.sort_order,
    active = true, updated_at = now();

  update public.transfer_events event
  set transfer_period_id = period.id
  from public.fixtures fixture, public.league_transfer_periods period
  where event.league_id = p_league_id and fixture.id = event.fixture_id
    and period.league_id = p_league_id and period.active
    and fixture.match_number between period.start_match_number and period.end_match_number;

  select count(*) into v_count from transfer_period_input;
  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (p_league_id, auth.uid(), 'transfer_periods_published', 'league', p_league_id::text,
    jsonb_build_object('period_count', v_count, 'periods', p_periods));
  return jsonb_build_object('period_count', v_count);
end;
$$;

revoke all on function public.publish_league_transfer_periods(uuid, jsonb) from public;
grant execute on function public.publish_league_transfer_periods(uuid, jsonb) to authenticated;

commit;
