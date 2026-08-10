-- Keep a submitted future XI independent while recalculating its transfer
-- charge whenever the immediately preceding submitted XI is resubmitted.
begin;

create or replace function public.recalculate_next_submitted_lineup_transfers(
  p_league_id uuid,
  p_member_id uuid,
  p_changed_match_number integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next_lineup public.lineup_submissions%rowtype;
  v_next_fixture public.fixtures%rowtype;
  v_previous_lineup_id uuid;
  v_period public.league_transfer_periods%rowtype;
  v_acquisition_mode text;
  v_initial_lineup boolean;
  v_uses_super_transfer boolean;
  v_period_used integer;
  v_recalculated_count integer := 0;
begin
  select lineup.* into v_next_lineup
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.league_id = p_league_id
    and lineup.member_id = p_member_id
    and lineup.status in ('submitted', 'locked')
    and fixture.match_number > p_changed_match_number
  order by fixture.match_number
  limit 1
  for update of lineup;

  if v_next_lineup.id is null then return; end if;

  select * into v_next_fixture
  from public.fixtures
  where id = v_next_lineup.fixture_id
  for update;

  if v_next_lineup.status = 'locked'
     or v_next_fixture.status <> 'scheduled'
     or now() >= coalesce(v_next_fixture.lineup_lock_at, v_next_fixture.scheduled_start) then
    raise exception 'Match % cannot be changed because the submitted Match % lineup is already locked',
      p_changed_match_number, v_next_fixture.match_number;
  end if;

  select prior.id into v_previous_lineup_id
  from public.lineup_submissions prior
  join public.fixtures prior_fixture on prior_fixture.id = prior.fixture_id
  where prior.league_id = p_league_id
    and prior.member_id = p_member_id
    and prior.status in ('submitted', 'locked')
    and prior_fixture.match_number < v_next_fixture.match_number
  order by prior_fixture.match_number desc
  limit 1;

  select * into v_period
  from public.league_transfer_periods period
  where period.league_id = p_league_id
    and period.active
    and v_next_fixture.match_number between period.start_match_number and period.end_match_number
  order by period.sort_order
  limit 1;
  if v_period.id is null then
    raise exception 'No transfer period is configured for Match %', v_next_fixture.match_number;
  end if;

  select coalesce(config.acquisition_mode, 'auction') into v_acquisition_mode
  from public.league_format_configs config
  where config.league_id = p_league_id;
  v_acquisition_mode := coalesce(v_acquisition_mode, 'auction');

  v_initial_lineup := v_period.first_match_free
    and not exists (
      select 1
      from public.lineup_submissions period_lineup
      join public.fixtures period_fixture on period_fixture.id = period_lineup.fixture_id
      where period_lineup.league_id = p_league_id
        and period_lineup.member_id = p_member_id
        and period_lineup.status in ('submitted', 'locked')
        and period_fixture.match_number between v_period.start_match_number and v_period.end_match_number
        and period_fixture.match_number < v_next_fixture.match_number
    );

  select exists (
    select 1
    from public.lineup_boosters lineup_booster
    join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
    where lineup_booster.lineup_id = v_next_lineup.id
      and booster.code = 'SUP-TR'
  ) into v_uses_super_transfer;

  delete from public.transfer_events event
  where event.league_id = p_league_id
    and event.member_id = p_member_id
    and event.fixture_id = v_next_fixture.id
    and event.reason = 'lineup_change';

  if not v_initial_lineup and not v_uses_super_transfer then
    insert into public.transfer_events (
      league_id, member_id, fixture_id, player_in_id, stage,
      transfer_period_id, transfer_count, reason, created_by
    )
    select p_league_id, p_member_id, v_next_fixture.id, current_player.player_id,
      case when v_next_fixture.stage in ('playoff', 'final') then 'playoff' else 'league' end,
      v_period.id, 1, 'lineup_change', auth.uid()
    from public.lineup_players current_player
    join public.league_players league_player
      on league_player.league_id = p_league_id
     and league_player.player_id = current_player.player_id
     and league_player.active
    where current_player.lineup_id = v_next_lineup.id
      and (v_acquisition_mode = 'all_open' or league_player.owner_member_id is distinct from p_member_id)
      and (v_previous_lineup_id is null or not exists (
        select 1
        from public.lineup_players previous_player
        where previous_player.lineup_id = v_previous_lineup_id
          and previous_player.player_id = current_player.player_id
      ));
    get diagnostics v_recalculated_count = row_count;
  end if;

  select coalesce(sum(event.transfer_count), 0) into v_period_used
  from public.transfer_events event
  where event.league_id = p_league_id
    and event.member_id = p_member_id
    and event.transfer_period_id = v_period.id
    and event.reason = 'lineup_change';

  if v_period_used > v_period.transfer_limit then
    raise exception '% transfer limit exceeded after recalculating Match %: % used, limit %. Update the future XI first.',
      v_period.name, v_next_fixture.match_number, v_period_used, v_period.transfer_limit;
  end if;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_league_id, auth.uid(), 'future_lineup_transfers_recalculated',
    'lineup_submission', v_next_lineup.id::text,
    jsonb_build_object(
      'changed_match_number', p_changed_match_number,
      'recalculated_match_number', v_next_fixture.match_number,
      'charged_transfers', v_recalculated_count,
      'transfer_period_id', v_period.id
    )
  );
end;
$$;

revoke all on function public.recalculate_next_submitted_lineup_transfers(uuid, uuid, integer) from public;

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
  v_audit_anchor text := $anchor$  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)$anchor$;
  v_audit_with_recalculation text := $replacement$  perform public.recalculate_next_submitted_lineup_transfers(
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

  if position('recalculate_next_submitted_lineup_transfers' in v_definition) = 0 then
    if position(v_audit_anchor in v_definition) = 0 then
      raise exception 'Could not locate lineup transfer audit insertion';
    end if;
    v_definition := replace(v_definition, v_audit_anchor, v_audit_with_recalculation);
  end if;

  execute v_definition;
end;
$$;

commit;
