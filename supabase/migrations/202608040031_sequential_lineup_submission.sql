-- Prevent owners from skipping fixtures when submitting future lineups.
-- Editing an existing future lineup is still allowed, provided the immediately
-- preceding fixture has a submitted or locked lineup for the same member.
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
  v_missing_fixture public.fixtures%rowtype;
  v_period public.league_transfer_periods%rowtype;
  v_member_id uuid;
  v_previous_lineup_id uuid;
  v_lineup_id uuid;
  v_acquisition_mode text;
  v_legacy_stage text;
  v_used integer;
  v_new_transfers integer := 0;
  v_initial_lineup boolean;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  v_member_id := public.current_member_id(v_fixture.league_id);
  if v_member_id is null then raise exception 'Active league membership required'; end if;

  select candidate.* into v_missing_fixture
  from public.fixtures candidate
  where candidate.league_id = v_fixture.league_id
    and candidate.match_number < v_fixture.match_number
    and not exists (
      select 1
      from public.lineup_submissions previous_submission
      where previous_submission.fixture_id = candidate.id
        and previous_submission.member_id = v_member_id
        and previous_submission.status in ('submitted', 'locked')
    )
  order by candidate.match_number
  limit 1;

  if found then
    raise exception 'Submit Match % before submitting Match %',
      v_missing_fixture.match_number, v_fixture.match_number;
  end if;

  select acquisition_mode into v_acquisition_mode
  from public.league_format_configs
  where league_id = v_fixture.league_id;
  v_acquisition_mode := coalesce(v_acquisition_mode, 'auction');

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
    where (v_acquisition_mode = 'all_open' or league_player.owner_member_id is distinct from v_member_id)
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
    raise exception '% transfer limit exceeded: % used + % new, limit %. Retain carried players or use SUP-TR.',
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
    where (v_acquisition_mode = 'all_open' or league_player.owner_member_id is distinct from v_member_id)
      and (v_previous_lineup_id is null or not exists (
        select 1 from public.lineup_players previous
        where previous.lineup_id = v_previous_lineup_id and previous.player_id = selected.player_id
      ));
  end if;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_fixture.league_id, auth.uid(), 'lineup_transfers_recorded', 'lineup_submission', v_lineup_id::text,
    jsonb_build_object('fixture_id', p_fixture_id, 'transfer_period_id', v_period.id,
      'transfer_period', v_period.name, 'acquisition_mode', v_acquisition_mode,
      'initial_lineup_free', v_initial_lineup,
      'charged_transfers', case when p_booster_code = 'SUP-TR' then 0 else v_new_transfers end,
      'used_before', v_used, 'balance_after', v_period.transfer_limit - v_used
        - case when p_booster_code = 'SUP-TR' then 0 else v_new_transfers end));
  return v_lineup_id;
end;
$$;

revoke all on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid) to authenticated;

commit;
