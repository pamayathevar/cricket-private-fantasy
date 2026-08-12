-- Settle abandoned/cancelled fixtures as No Result. The void fixture's XI is
-- removed from the carry-forward chain, its transfer/booster usage is refunded,
-- later unlocked XIs are reset, and the first later locked XI is atomically
-- recharged against the last valid pre-void XI without changing its players.
begin;

create or replace function public.settle_no_result_match(p_fixture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_no_result_lineup_ids uuid[] := '{}'::uuid[];
  v_future_lineup_ids uuid[] := '{}'::uuid[];
  v_future_fixture_ids uuid[] := '{}'::uuid[];
  v_future_match_numbers integer[] := '{}'::integer[];
  v_member_count integer := 0;
  v_future_lineup_count integer := 0;
  v_future_member_count integer := 0;
  v_refunded_transfer_count integer := 0;
  v_refunded_booster_count integer := 0;
  v_locked_lineups_recalculated integer := 0;
  v_locked_transfers_before integer := 0;
  v_locked_transfers_after integer := 0;
  v_locked_recalculation_details jsonb := '[]'::jsonb;
  v_existing_settlement jsonb;
  v_member record;
  v_locked_lineup record;
  v_previous_lineup_id uuid;
  v_previous_match_number integer;
  v_period public.league_transfer_periods%rowtype;
  v_acquisition_mode text;
  v_initial_lineup boolean;
  v_uses_super_transfer boolean;
  v_reversed_count integer;
  v_recharged_count integer;
begin
  select * into v_fixture
  from public.fixtures
  where id = p_fixture_id;

  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_admin(v_fixture.league_id) then
    raise exception 'League admin access required';
  end if;
  if v_fixture.status not in ('abandoned', 'cancelled') then
    raise exception 'Fixture must be marked abandoned or cancelled before No Result settlement';
  end if;

  -- Serialize No Result settlement with every owner's lineup chain in this
  -- league. Use the same advisory-lock key as lineup submission, in stable
  -- member order, before locking the fixture row to avoid lock inversion.
  perform pg_advisory_xact_lock(hashtextextended(
    v_fixture.league_id::text || ':no-result-settlement', 0
  ));
  for v_member in
    select member.id
    from public.league_members member
    where member.league_id = v_fixture.league_id
      and member.status = 'active'
      and member.role in ('owner', 'league_admin')
    order by member.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      v_fixture.league_id::text || ':' || v_member.id::text, 0
    ));
  end loop;

  select * into v_fixture
  from public.fixtures
  where id = p_fixture_id
  for update;
  if v_fixture.status not in ('abandoned', 'cancelled') then
    raise exception 'Fixture status changed before No Result settlement';
  end if;

  select audit.after_data into v_existing_settlement
  from public.audit_events audit
  where audit.league_id = v_fixture.league_id
    and audit.action = 'no_result_match_settled'
    and audit.entity_type = 'fixture'
    and audit.entity_id = p_fixture_id::text
  order by audit.created_at desc
  limit 1;

  if found then
    return coalesce(v_existing_settlement, '{}'::jsonb) || jsonb_build_object(
      'already_settled', true,
      'scoring_status', 'published'
    );
  end if;

  select coalesce(array_agg(lineup.id order by lineup.member_id), '{}'::uuid[])
    into v_no_result_lineup_ids
  from public.lineup_submissions lineup
  where lineup.fixture_id = p_fixture_id
    and lineup.status in ('submitted', 'locked', 'cancelled');

  select
    coalesce(array_agg(lineup.id order by fixture.match_number, lineup.member_id), '{}'::uuid[]),
    count(distinct lineup.member_id)::integer
    into v_future_lineup_ids, v_future_member_count
  from public.lineup_submissions lineup
  join public.fixtures fixture on fixture.id = lineup.fixture_id
  where lineup.league_id = v_fixture.league_id
    and lineup.status in ('draft', 'submitted')
    and lineup.member_id in (
      select no_result_lineup.member_id
      from public.lineup_submissions no_result_lineup
      where no_result_lineup.id = any(v_no_result_lineup_ids)
    )
    and fixture.match_number > v_fixture.match_number
    and fixture.status = 'scheduled'
    and now() < coalesce(fixture.lineup_lock_at, fixture.scheduled_start);

  select
    coalesce(array_agg(fixture.id order by fixture.match_number), '{}'::uuid[]),
    coalesce(array_agg(fixture.match_number order by fixture.match_number), '{}'::integer[])
    into v_future_fixture_ids, v_future_match_numbers
  from public.fixtures fixture
  where fixture.league_id = v_fixture.league_id
    and fixture.id in (
      select lineup.fixture_id
      from public.lineup_submissions lineup
      where lineup.id = any(v_future_lineup_ids)
    );

  v_future_lineup_count := coalesce(cardinality(v_future_lineup_ids), 0);

  select coalesce(sum(event.transfer_count), 0)::integer
    into v_refunded_transfer_count
  from public.transfer_events event
  where event.league_id = v_fixture.league_id
    and event.reason = 'lineup_change'
    and (
      event.fixture_id = p_fixture_id
      or exists (
        select 1
        from public.lineup_submissions future_lineup
        where future_lineup.id = any(v_future_lineup_ids)
          and future_lineup.fixture_id = event.fixture_id
          and future_lineup.member_id = event.member_id
      )
    );

  select count(*)::integer into v_refunded_booster_count
  from public.lineup_boosters booster
  where booster.league_id = v_fixture.league_id
    and (
      booster.fixture_id = p_fixture_id
      or booster.lineup_id = any(v_future_lineup_ids)
    );

  -- If a later XI is already locked, its players are immutable but its old
  -- transfer charge may have been calculated against the now-void XI. Rebase
  -- only the first surviving locked XI for each affected owner against their
  -- latest valid XI. Every still-later locked XI already follows from that XI.
  for v_locked_lineup in
    select distinct on (lineup.member_id)
      lineup.id as lineup_id,
      lineup.member_id,
      fixture.id as fixture_id,
      fixture.match_number,
      fixture.stage
    from public.lineup_submissions lineup
    join public.fixtures fixture on fixture.id = lineup.fixture_id
    where lineup.league_id = v_fixture.league_id
      and lineup.member_id in (
        select no_result_lineup.member_id
        from public.lineup_submissions no_result_lineup
        where no_result_lineup.id = any(v_no_result_lineup_ids)
      )
      and lineup.status in ('submitted', 'locked')
      and fixture.match_number > v_fixture.match_number
      and fixture.status not in ('abandoned', 'cancelled')
      and (
        lineup.status = 'locked'
        or fixture.status <> 'scheduled'
        or now() >= coalesce(fixture.lineup_lock_at, fixture.scheduled_start)
      )
    order by lineup.member_id, fixture.match_number
  loop
    v_previous_lineup_id := null;
    v_previous_match_number := null;
    v_initial_lineup := false;
    v_uses_super_transfer := false;
    v_reversed_count := 0;
    v_recharged_count := 0;

    select prior.id, prior_fixture.match_number
      into v_previous_lineup_id, v_previous_match_number
    from public.lineup_submissions prior
    join public.fixtures prior_fixture on prior_fixture.id = prior.fixture_id
    where prior.league_id = v_fixture.league_id
      and prior.member_id = v_locked_lineup.member_id
      and prior.status in ('submitted', 'locked')
      and prior_fixture.status not in ('abandoned', 'cancelled')
      and prior_fixture.match_number < v_locked_lineup.match_number
      and prior.id <> all(v_no_result_lineup_ids)
      and prior.id <> all(v_future_lineup_ids)
      and (
        prior.status = 'locked'
        or prior_fixture.status <> 'scheduled'
        or now() >= coalesce(prior_fixture.lineup_lock_at, prior_fixture.scheduled_start)
      )
    order by prior_fixture.match_number desc
    limit 1;

    select * into v_period
    from public.league_transfer_periods period
    where period.league_id = v_fixture.league_id
      and period.active
      and v_locked_lineup.match_number between period.start_match_number and period.end_match_number
    order by period.sort_order
    limit 1;
    if v_period.id is null then
      raise exception 'No transfer period is configured for locked Match %',
        v_locked_lineup.match_number;
    end if;

    select coalesce(config.acquisition_mode, 'auction') into v_acquisition_mode
    from public.league_format_configs config
    where config.league_id = v_fixture.league_id;
    v_acquisition_mode := coalesce(v_acquisition_mode, 'auction');

    v_initial_lineup := v_period.first_match_free
      and not exists (
        select 1
        from public.lineup_submissions period_lineup
        join public.fixtures period_fixture on period_fixture.id = period_lineup.fixture_id
        where period_lineup.league_id = v_fixture.league_id
          and period_lineup.member_id = v_locked_lineup.member_id
          and period_lineup.status in ('submitted', 'locked')
          and period_fixture.status not in ('abandoned', 'cancelled')
          and period_fixture.match_number between v_period.start_match_number and v_period.end_match_number
          and period_fixture.match_number < v_locked_lineup.match_number
          and period_lineup.id <> all(v_future_lineup_ids)
      );

    select exists (
      select 1
      from public.lineup_boosters lineup_booster
      join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
      where lineup_booster.lineup_id = v_locked_lineup.lineup_id
        and booster.code = 'SUP-TR'
    ) into v_uses_super_transfer;

    select coalesce(sum(event.transfer_count), 0)::integer into v_reversed_count
    from public.transfer_events event
    where event.league_id = v_fixture.league_id
      and event.member_id = v_locked_lineup.member_id
      and event.fixture_id = v_locked_lineup.fixture_id
      and event.reason = 'lineup_change';

    -- Preserve the original locked-match charge as refunded history, then
    -- create a new authoritative charge from the last valid XI.
    update public.transfer_events event
    set reason = 'abandoned_refund'
    where event.league_id = v_fixture.league_id
      and event.member_id = v_locked_lineup.member_id
      and event.fixture_id = v_locked_lineup.fixture_id
      and event.reason = 'lineup_change';

    if not v_initial_lineup and not v_uses_super_transfer then
      insert into public.transfer_events (
        league_id, member_id, fixture_id, player_in_id, stage,
        transfer_period_id, transfer_count, reason, created_by
      )
      select v_fixture.league_id, v_locked_lineup.member_id,
        v_locked_lineup.fixture_id, current_player.player_id,
        case when v_locked_lineup.stage in ('playoff', 'final') then 'playoff' else 'league' end,
        v_period.id, 1, 'lineup_change', auth.uid()
      from public.lineup_players current_player
      join public.league_players league_player
        on league_player.league_id = v_fixture.league_id
       and league_player.player_id = current_player.player_id
      where current_player.lineup_id = v_locked_lineup.lineup_id
        and (
          v_acquisition_mode = 'all_open'
          or league_player.owner_member_id is distinct from v_locked_lineup.member_id
        )
        and (
          v_previous_lineup_id is null
          or not exists (
            select 1
            from public.lineup_players previous_player
            where previous_player.lineup_id = v_previous_lineup_id
              and previous_player.player_id = current_player.player_id
          )
        );
      get diagnostics v_recharged_count = row_count;
    end if;

    v_locked_lineups_recalculated := v_locked_lineups_recalculated + 1;
    v_locked_transfers_before := v_locked_transfers_before + v_reversed_count;
    v_locked_transfers_after := v_locked_transfers_after + v_recharged_count;
    v_locked_recalculation_details := v_locked_recalculation_details || jsonb_build_array(
      jsonb_build_object(
        'member_id', v_locked_lineup.member_id,
        'lineup_id', v_locked_lineup.lineup_id,
        'match_number', v_locked_lineup.match_number,
        'previous_lineup_id', v_previous_lineup_id,
        'previous_match_number', v_previous_match_number,
        'transfers_before', v_reversed_count,
        'transfers_after', v_recharged_count,
        'first_valid_period_lineup_free', v_initial_lineup,
        'super_transfer_used', v_uses_super_transfer
      )
    );
  end loop;

  -- Preserve calculated source rows for audit/review, but ensure they are not
  -- exposed as published player points for a fixture that produced no result.
  update public.player_match_points
  set published_at = null
  where fixture_id = p_fixture_id;

  delete from public.special_player_score_adjustments
  where fixture_id = p_fixture_id;

  delete from public.member_match_scores
  where fixture_id = p_fixture_id;

  -- Keep explicit zero-point records, matching the confirmed league rule, but
  -- do not assign a match rank or winner for a No Result fixture.
  insert into public.member_match_scores (
    fixture_id, member_id, lineup_id, base_points, captain_bonus,
    vice_captain_bonus, impact_adjustment, ownership_adjustment,
    rank, calculation_breakdown, published_at
  )
  select p_fixture_id, lineup.member_id, lineup.id, 0, 0, 0, 0, 0, null,
    jsonb_build_object(
      'no_result', true,
      'fixture_status', v_fixture.status,
      'final_points', 0
    ),
    now()
  from public.lineup_submissions lineup
  where lineup.id = any(v_no_result_lineup_ids);
  get diagnostics v_member_count = row_count;

  -- Retain refunded transfer rows as an explainable historical record. Usage
  -- totals count only lineup_change rows, so changing the reason returns the
  -- allowance without destroying the original player/match detail.
  update public.transfer_events event
  set reason = 'abandoned_refund'
  where event.league_id = v_fixture.league_id
    and event.reason = 'lineup_change'
    and (
      event.fixture_id = p_fixture_id
      or exists (
        select 1
        from public.lineup_submissions future_lineup
        where future_lineup.id = any(v_future_lineup_ids)
          and future_lineup.fixture_id = event.fixture_id
          and future_lineup.member_id = event.member_id
      )
    );

  delete from public.lineup_boosters booster
  where booster.league_id = v_fixture.league_id
    and (
      booster.fixture_id = p_fixture_id
      or booster.lineup_id = any(v_future_lineup_ids)
    );

  -- The No Result XI remains in history as cancelled and can no longer become
  -- the previous-lineup baseline for a later match.
  update public.lineup_submissions lineup
  set status = 'cancelled', updated_at = now()
  where lineup.id = any(v_no_result_lineup_ids);

  -- Later locked/live/completed XI selections are intentionally untouched;
  -- their first affected transfer charge was already rebased above. Deleting
  -- only still-open future submissions lets the client rebuild the remaining
  -- chain from the most recent surviving valid XI.
  delete from public.lineup_submissions lineup
  where lineup.id = any(v_future_lineup_ids);

  update public.fixtures
  set scoring_status = 'published', updated_at = now()
  where id = p_fixture_id;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_fixture.league_id,
    auth.uid(),
    'no_result_match_settled',
    'fixture',
    p_fixture_id::text,
    jsonb_build_object(
      'fixture_status', v_fixture.status,
      'scoring_status', v_fixture.scoring_status,
      'lineup_ids', to_jsonb(v_no_result_lineup_ids)
    ),
    jsonb_build_object(
      'member_count', v_member_count,
      'zero_points', true,
      'match_rank_assigned', false,
      'transfers_refunded', v_refunded_transfer_count,
      'boosters_refunded', v_refunded_booster_count,
      'future_lineups_reset', v_future_lineup_count,
      'future_owners_affected', v_future_member_count,
      'future_match_numbers', to_jsonb(v_future_match_numbers),
      'locked_future_lineups_preserved', true,
      'locked_lineups_recalculated', v_locked_lineups_recalculated,
      'locked_transfers_before', v_locked_transfers_before,
      'locked_transfers_after', v_locked_transfers_after,
      'locked_recalculation_details', v_locked_recalculation_details
    )
  );

  return jsonb_build_object(
    'member_count', v_member_count,
    'scoring_status', 'published',
    'already_settled', false,
    'transfers_refunded', v_refunded_transfer_count,
    'boosters_refunded', v_refunded_booster_count,
    'future_lineups_reset', v_future_lineup_count,
    'future_owners_affected', v_future_member_count,
    'future_match_numbers', to_jsonb(v_future_match_numbers),
    'locked_lineups_recalculated', v_locked_lineups_recalculated,
    'locked_transfers_before', v_locked_transfers_before,
    'locked_transfers_after', v_locked_transfers_after,
    'locked_recalculation_details', v_locked_recalculation_details
  );
end;
$$;

-- Backward-compatible entry point for older clients and existing runbooks.
create or replace function public.settle_abandoned_match(p_fixture_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.settle_no_result_match(p_fixture_id)
$$;

revoke all on function public.settle_no_result_match(uuid) from public, anon;
revoke all on function public.settle_abandoned_match(uuid) from public, anon;
grant execute on function public.settle_no_result_match(uuid) to authenticated;
grant execute on function public.settle_abandoned_match(uuid) to authenticated;

-- The latest enforced submission RPC was assembled by earlier migrations.
-- Patch its carry-forward assumptions in place so void fixtures neither
-- block sequential submission nor consume the first valid free submission.
do $$
declare
  v_definition text;
  v_usage_anchor text := $anchor$    and used_fixture.match_number < v_fixture.match_number;$anchor$;
  v_usage_replacement text := $replacement$    and used_fixture.match_number < v_fixture.match_number
    and used_fixture.status not in ('abandoned', 'cancelled');$replacement$;
  v_candidate_anchor text := $anchor$    and candidate.match_number < v_fixture.match_number
    and not exists ($anchor$;
  v_candidate_replacement text := $replacement$    and candidate.match_number < v_fixture.match_number
    and candidate.status = 'scheduled'
    and now() < coalesce(candidate.lineup_lock_at, candidate.scheduled_start)
    and not exists ($replacement$;
  v_initial_anchor text := $anchor$        and period_lineup.status in ('submitted', 'locked')
        and period_fixture.match_number between v_period.start_match_number and v_period.end_match_number$anchor$;
  v_initial_replacement text := $replacement$        and period_lineup.status in ('submitted', 'locked')
        and period_fixture.status not in ('abandoned', 'cancelled')
        and period_fixture.match_number between v_period.start_match_number and v_period.end_match_number$replacement$;
begin
  v_definition := pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  );

  if position($needle$candidate.status = 'scheduled'$needle$ in v_definition) = 0 then
    if position(v_candidate_anchor in v_definition) = 0 then
      raise exception 'Could not locate sequential fixture validation in enforced lineup submission';
    end if;
    v_definition := replace(v_definition, v_candidate_anchor, v_candidate_replacement);
  end if;

  if position($needle$period_fixture.status not in ('abandoned', 'cancelled')$needle$ in v_definition) = 0 then
    if position(v_initial_anchor in v_definition) = 0 then
      raise exception 'Could not locate initial free-lineup calculation in enforced lineup submission';
    end if;
    v_definition := replace(v_definition, v_initial_anchor, v_initial_replacement);
  end if;

  if position($needle$used_fixture.status not in ('abandoned', 'cancelled')$needle$ in v_definition) = 0 then
    if position(v_usage_anchor in v_definition) = 0 then
      raise exception 'Could not locate prior transfer usage calculation in enforced lineup submission';
    end if;
    v_definition := replace(v_definition, v_usage_anchor, v_usage_replacement);
  end if;

  execute v_definition;
end;
$$;

revoke all on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid)
  from public, anon;
grant execute on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid)
  to authenticated;

-- Keep the explicit zero-point score rows for audit/history without treating a
-- void fixture as a scored match in either the overall or phase leaderboard.
create or replace view public.league_standings with (security_invoker = true) as
select member.league_id,
       member.id as member_id,
       member.display_name,
       coalesce(sum(score.total_points), 0)::numeric(14,2) as total_points,
       count(score.id) as matches_scored,
       dense_rank() over (
         partition by member.league_id
         order by coalesce(sum(score.total_points), 0) desc
       ) as rank
from public.league_members member
left join public.member_match_scores score
 on score.member_id = member.id
 and score.published_at is not null
 and (score.calculation_breakdown->>'no_result') is distinct from 'true'
where member.status = 'active'
  and member.role in ('league_admin', 'owner')
group by member.league_id, member.id, member.display_name;

create or replace view public.league_phase_standings with (security_invoker = true) as
select member.league_id,
       phase.id as phase_id,
       phase.code as phase_code,
       phase.name as phase_name,
       phase.sort_order as phase_order,
       member.id as member_id,
       member.display_name,
       coalesce(sum(score.total_points), 0)::numeric(14,2) as total_points,
       count(score.id) as matches_scored,
       dense_rank() over (
         partition by member.league_id, phase.id
         order by coalesce(sum(score.total_points), 0) desc
       ) as rank
from public.league_members member
join public.league_phases phase
  on phase.league_id = member.league_id and phase.active
left join public.fixtures fixture on fixture.phase_id = phase.id
left join public.member_match_scores score
  on score.member_id = member.id
 and score.fixture_id = fixture.id
 and score.published_at is not null
 and (score.calculation_breakdown->>'no_result') is distinct from 'true'
where member.status = 'active'
  and member.role in ('league_admin', 'owner')
group by member.league_id, phase.id, phase.code, phase.name, phase.sort_order,
         member.id, member.display_name;

grant select on public.league_standings, public.league_phase_standings to authenticated;

commit;
