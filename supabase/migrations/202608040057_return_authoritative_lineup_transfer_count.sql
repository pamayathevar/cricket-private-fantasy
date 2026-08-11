-- Return the transfer count persisted by the enforced submission transaction so
-- the confirmation UI and History report the same database-authoritative value.
begin;

create or replace function public.submit_lineup_with_transfer_result(
  p_fixture_id uuid,
  p_player_ids uuid[],
  p_captain_player_id uuid default null,
  p_vice_captain_player_id uuid default null,
  p_impact_player_id uuid default null,
  p_impact_type text default null,
  p_booster_code text default null,
  p_booster_player_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_member_id uuid;
  v_lineup_id uuid;
  v_charged_transfers integer;
begin
  select * into v_fixture
  from public.fixtures
  where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;

  v_member_id := public.current_member_id(v_fixture.league_id);
  if v_member_id is null then raise exception 'Active league membership required'; end if;

  v_lineup_id := public.submit_lineup_with_transfer_enforcement(
    p_fixture_id,
    p_player_ids,
    p_captain_player_id,
    p_vice_captain_player_id,
    p_impact_player_id,
    p_impact_type,
    p_booster_code,
    p_booster_player_id
  );

  select coalesce(sum(event.transfer_count), 0)::integer
    into v_charged_transfers
  from public.transfer_events event
  where event.league_id = v_fixture.league_id
    and event.member_id = v_member_id
    and event.fixture_id = p_fixture_id
    and event.reason = 'lineup_change';

  return jsonb_build_object(
    'lineup_id', v_lineup_id,
    'charged_transfers', v_charged_transfers
  );
end;
$$;

revoke all on function public.submit_lineup_with_transfer_result(uuid, uuid[], uuid, uuid, uuid, text, text, uuid)
  from public, anon;
grant execute on function public.submit_lineup_with_transfer_result(uuid, uuid[], uuid, uuid, uuid, text, text, uuid)
  to authenticated;

commit;
