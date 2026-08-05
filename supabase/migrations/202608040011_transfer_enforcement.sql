-- Enforce cumulative transfer limits and record only fresh, non-owned additions.
begin;

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
  v_league public.leagues%rowtype;
  v_member_id uuid;
  v_previous_lineup_id uuid;
  v_lineup_id uuid;
  v_stage text;
  v_limit integer;
  v_used integer;
  v_new_transfers integer;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  select * into v_league from public.leagues where id = v_fixture.league_id;
  v_member_id := public.current_member_id(v_fixture.league_id);
  if v_member_id is null then raise exception 'Active league membership required'; end if;

  v_stage := case when v_fixture.stage in ('playoff', 'final') then 'playoff' else 'league' end;
  v_limit := case when v_stage = 'league' then v_league.league_stage_transfer_limit else v_league.playoff_transfer_limit end;

  select lineup.id into v_previous_lineup_id
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.member_id = v_member_id
    and lineup.league_id = v_fixture.league_id
    and lineup.status in ('submitted', 'locked')
    and fixture.match_number < v_fixture.match_number
  order by fixture.match_number desc
  limit 1;

  select count(*) into v_new_transfers
  from unnest(p_player_ids) selected(player_id)
  join public.league_players league_player
    on league_player.league_id = v_fixture.league_id
   and league_player.player_id = selected.player_id
   and league_player.active
  where league_player.owner_member_id is distinct from v_member_id
    and not exists (
      select 1 from public.lineup_players previous
      where previous.lineup_id = v_previous_lineup_id
        and previous.player_id = selected.player_id
    );

  select coalesce(sum(transfer_count), 0) into v_used
  from public.transfer_events
  where league_id = v_fixture.league_id
    and member_id = v_member_id
    and stage = v_stage
    and reason = 'lineup_change'
    and fixture_id is distinct from p_fixture_id;

  if coalesce(p_booster_code, '') <> 'SUP-TR' and v_used + v_new_transfers > v_limit then
    raise exception '% transfer limit exceeded: % used + % new, limit %',
      case when v_stage = 'league' then 'League-stage' else 'Playoff' end,
      v_used, v_new_transfers, v_limit;
  end if;

  v_lineup_id := public.submit_lineup_with_booster(
    p_fixture_id, p_player_ids, p_captain_player_id, p_vice_captain_player_id,
    p_impact_player_id, p_impact_type, p_booster_code, p_booster_player_id
  );

  delete from public.transfer_events
  where league_id = v_fixture.league_id
    and member_id = v_member_id
    and fixture_id = p_fixture_id
    and reason = 'lineup_change';

  if coalesce(p_booster_code, '') <> 'SUP-TR' then
    insert into public.transfer_events (
      league_id, member_id, fixture_id, player_in_id, stage,
      transfer_count, reason, created_by
    )
    select v_fixture.league_id, v_member_id, p_fixture_id, selected.player_id,
      v_stage, 1, 'lineup_change', auth.uid()
    from unnest(p_player_ids) selected(player_id)
    join public.league_players league_player
      on league_player.league_id = v_fixture.league_id
     and league_player.player_id = selected.player_id
     and league_player.active
    where league_player.owner_member_id is distinct from v_member_id
      and not exists (
        select 1 from public.lineup_players previous
        where previous.lineup_id = v_previous_lineup_id
          and previous.player_id = selected.player_id
      );
  end if;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (
    v_fixture.league_id, auth.uid(), 'lineup_transfers_recorded', 'lineup_submission', v_lineup_id::text,
    jsonb_build_object('fixture_id', p_fixture_id, 'stage', v_stage, 'charged_transfers', case when p_booster_code = 'SUP-TR' then 0 else v_new_transfers end, 'used_before', v_used)
  );
  return v_lineup_id;
end;
$$;

revoke all on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) to authenticated;

commit;
