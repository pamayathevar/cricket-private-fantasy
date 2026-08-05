-- Prevent partial publication and settle abandoned fixtures without consuming transfers or boosters.
begin;

create or replace function public.publish_match_scores_safe(p_fixture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_calculation_version integer;
  v_missing integer;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_admin(v_fixture.league_id) then raise exception 'League admin access required'; end if;
  select max(calculation_version) into v_calculation_version from public.player_match_points where fixture_id = p_fixture_id;
  select count(*) into v_missing
  from public.lineup_submissions lineup
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  where lineup.fixture_id = p_fixture_id
    and lineup.status in ('submitted', 'locked')
    and not exists (
      select 1 from public.player_match_points points
      where points.fixture_id = p_fixture_id
        and points.player_id = lineup_player.player_id
        and points.calculation_version = v_calculation_version
    );
  if v_missing > 0 then raise exception 'Cannot publish: % selected player score rows are missing', v_missing; end if;
  if not exists (select 1 from public.lineup_submissions where fixture_id = p_fixture_id and status in ('submitted', 'locked')) then
    raise exception 'Cannot publish a match with no submitted lineups';
  end if;
  return public.publish_match_scores(p_fixture_id);
end;
$$;

create or replace function public.settle_abandoned_match(p_fixture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_count integer;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_admin(v_fixture.league_id) then raise exception 'League admin access required'; end if;
  if v_fixture.status <> 'abandoned' then raise exception 'Fixture is not marked abandoned'; end if;

  delete from public.member_match_scores where fixture_id = p_fixture_id;
  insert into public.member_match_scores (
    fixture_id, member_id, lineup_id, base_points, captain_bonus,
    vice_captain_bonus, impact_adjustment, ownership_adjustment,
    rank, calculation_breakdown, published_at
  )
  select p_fixture_id, member_id, id, 0, 0, 0, 0, 0, 1,
    jsonb_build_object('abandoned', true, 'final_points', 0), now()
  from public.lineup_submissions
  where fixture_id = p_fixture_id and status in ('submitted', 'locked');
  get diagnostics v_count = row_count;

  delete from public.transfer_events where fixture_id = p_fixture_id and reason = 'lineup_change';
  delete from public.lineup_boosters where fixture_id = p_fixture_id;
  update public.lineup_submissions set status = 'locked', locked_at = coalesce(locked_at, now()), updated_at = now()
  where fixture_id = p_fixture_id and status = 'submitted';
  update public.fixtures set scoring_status = 'published', updated_at = now() where id = p_fixture_id;
  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_fixture.league_id, auth.uid(), 'abandoned_match_settled', 'fixture', p_fixture_id::text,
    jsonb_build_object('member_count', v_count, 'transfers_refunded', true, 'boosters_refunded', true));
  return jsonb_build_object('member_count', v_count, 'scoring_status', 'published');
end;
$$;

revoke all on function public.publish_match_scores_safe(uuid) from public;
revoke all on function public.settle_abandoned_match(uuid) from public;
grant execute on function public.publish_match_scores_safe(uuid) to authenticated;
grant execute on function public.settle_abandoned_match(uuid) to authenticated;

commit;
