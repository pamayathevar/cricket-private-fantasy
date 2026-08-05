-- Replace fixed league/playoff transfer buckets with configurable match ranges.
begin;

create table if not exists public.league_transfer_periods (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  code text not null,
  name text not null,
  start_match_number integer not null check (start_match_number > 0),
  end_match_number integer not null check (end_match_number >= start_match_number),
  transfer_limit integer not null check (transfer_limit >= 0),
  first_match_free boolean not null default true,
  sort_order integer not null check (sort_order > 0),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, code)
);

alter table public.league_transfer_periods enable row level security;
drop policy if exists transfer_periods_read on public.league_transfer_periods;
create policy transfer_periods_read on public.league_transfer_periods
  for select to authenticated using (public.is_league_member(league_id));
drop policy if exists transfer_periods_admin_all on public.league_transfer_periods;
create policy transfer_periods_admin_all on public.league_transfer_periods
  for all to authenticated using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

-- RLS decides which rows are visible; this table-level grant allows the client to query them.
grant select on public.league_transfer_periods to authenticated;

alter table public.transfer_events
  add column if not exists transfer_period_id uuid references public.league_transfer_periods(id) on delete set null;
create index if not exists transfer_events_period_member_idx
  on public.transfer_events(transfer_period_id, member_id);

insert into public.league_transfer_periods (
  league_id, code, name, start_match_number, end_match_number,
  transfer_limit, first_match_free, sort_order
)
select league.id, seed.code, seed.name, seed.start_match, seed.end_match,
  seed.transfer_limit, true, seed.sort_order
from public.leagues league
cross join lateral (
  values
    ('league', 'League stage', 1, 70, league.league_stage_transfer_limit, 1),
    ('playoff', 'Playoffs', 71, 74, league.playoff_transfer_limit, 2)
) seed(code, name, start_match, end_match, transfer_limit, sort_order)
where league.id = '10000000-0000-4000-8000-000000002026'
on conflict (league_id, code) do nothing;

update public.transfer_events event
set transfer_period_id = period.id
from public.fixtures fixture, public.league_transfer_periods period
where fixture.id = event.fixture_id
  and period.league_id = event.league_id
  and period.active
  and fixture.match_number between period.start_match_number and period.end_match_number
  and event.transfer_period_id is null;

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
  if exists (
    select 1 from transfer_period_input a join transfer_period_input b
      on a.code < b.code and int4range(a.start_match, a.end_match, '[]') && int4range(b.start_match, b.end_match, '[]')
  ) then raise exception 'Transfer period match ranges cannot overlap'; end if;

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

  -- Keep historical usage aligned when an admin splits or changes period ranges.
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

create or replace function public.submit_lineup_with_transfer_enforcement(
  p_fixture_id uuid,
  p_player_ids uuid[],
  p_captain_player_id uuid default null,
  p_vice_captain_player_id uuid default null,
  p_impact_player_id uuid default null,
  p_impact_type text default null,
  p_booster_code text default null,
  p_booster_player_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_period public.league_transfer_periods%rowtype;
  v_member_id uuid;
  v_previous_lineup_id uuid;
  v_lineup_id uuid;
  v_legacy_stage text;
  v_used integer;
  v_new_transfers integer := 0;
  v_initial_lineup boolean;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  v_member_id := public.current_member_id(v_fixture.league_id);
  if v_member_id is null then raise exception 'Active league membership required'; end if;

  select * into v_period from public.league_transfer_periods
  where league_id = v_fixture.league_id and active
    and v_fixture.match_number between start_match_number and end_match_number
  order by sort_order limit 1;
  if not found then raise exception 'No transfer period is configured for Match %', v_fixture.match_number; end if;
  v_legacy_stage := case when v_fixture.stage in ('playoff', 'final') then 'playoff' else 'league' end;

  select lineup.id into v_previous_lineup_id
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.member_id = v_member_id and lineup.league_id = v_fixture.league_id
    and lineup.status in ('submitted', 'locked')
    and fixture.match_number < v_fixture.match_number
  order by fixture.match_number desc limit 1;
  v_initial_lineup := v_period.first_match_free
    and v_fixture.match_number = v_period.start_match_number;

  if not v_initial_lineup then
    select count(*) into v_new_transfers
    from unnest(p_player_ids) selected(player_id)
    join public.league_players league_player on league_player.league_id = v_fixture.league_id
      and league_player.player_id = selected.player_id and league_player.active
    where league_player.owner_member_id is distinct from v_member_id
      and (v_previous_lineup_id is null or not exists (
        select 1 from public.lineup_players previous
        where previous.lineup_id = v_previous_lineup_id and previous.player_id = selected.player_id
      ));
  end if;

  select coalesce(sum(transfer_count), 0) into v_used from public.transfer_events
  where league_id = v_fixture.league_id and member_id = v_member_id
    and transfer_period_id = v_period.id and reason = 'lineup_change'
    and fixture_id is distinct from p_fixture_id;

  if coalesce(p_booster_code, '') <> 'SUP-TR' and v_used + v_new_transfers > v_period.transfer_limit then
    raise exception '% transfer limit exceeded: % used + % new, limit %. Select owned or carried players, or use SUP-TR.',
      v_period.name, v_used, v_new_transfers, v_period.transfer_limit;
  end if;

  v_lineup_id := public.submit_lineup_with_booster(
    p_fixture_id, p_player_ids, p_captain_player_id, p_vice_captain_player_id,
    p_impact_player_id, p_impact_type, p_booster_code, p_booster_player_id
  );
  delete from public.transfer_events where league_id = v_fixture.league_id
    and member_id = v_member_id and fixture_id = p_fixture_id and reason = 'lineup_change';

  if not v_initial_lineup and coalesce(p_booster_code, '') <> 'SUP-TR' then
    insert into public.transfer_events (
      league_id, member_id, fixture_id, player_in_id, stage, transfer_period_id,
      transfer_count, reason, created_by
    )
    select v_fixture.league_id, v_member_id, p_fixture_id, selected.player_id,
      v_legacy_stage, v_period.id, 1, 'lineup_change', auth.uid()
    from unnest(p_player_ids) selected(player_id)
    join public.league_players league_player on league_player.league_id = v_fixture.league_id
      and league_player.player_id = selected.player_id and league_player.active
    where league_player.owner_member_id is distinct from v_member_id
      and (v_previous_lineup_id is null or not exists (
        select 1 from public.lineup_players previous
        where previous.lineup_id = v_previous_lineup_id and previous.player_id = selected.player_id
      ));
  end if;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_fixture.league_id, auth.uid(), 'lineup_transfers_recorded', 'lineup_submission', v_lineup_id::text,
    jsonb_build_object('fixture_id', p_fixture_id, 'transfer_period_id', v_period.id,
      'transfer_period', v_period.name, 'initial_lineup_free', v_initial_lineup,
      'charged_transfers', case when p_booster_code = 'SUP-TR' then 0 else v_new_transfers end,
      'used_before', v_used, 'balance_after', v_period.transfer_limit - v_used
        - case when p_booster_code = 'SUP-TR' then 0 else v_new_transfers end));
  return v_lineup_id;
end;
$$;

revoke all on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) to authenticated;

commit;
