-- Apply ownership deductions only when the league format enables them.
begin;

create or replace function public.publish_match_scores(p_fixture_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixture public.fixtures%rowtype;
  v_calculation_version integer;
  v_member_count integer;
  v_was_published boolean;
  v_acquisition_mode text;
  v_ownership_deductions_enabled boolean;
begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;
  if not found then raise exception 'Fixture not found'; end if;
  if not public.is_league_admin(v_fixture.league_id) then raise exception 'League admin access required'; end if;
  if v_fixture.scoring_status <> 'review' then raise exception 'Match points must be in review before publishing'; end if;
  select max(calculation_version) into v_calculation_version from public.player_match_points where fixture_id = p_fixture_id;
  if v_calculation_version is null then raise exception 'No calculated player points found'; end if;
  select exists (select 1 from public.member_match_scores where fixture_id = p_fixture_id and published_at is not null) into v_was_published;

  select acquisition_mode, other_owner_deductions_enabled
    into v_acquisition_mode, v_ownership_deductions_enabled
  from public.league_format_configs
  where league_id = v_fixture.league_id;
  v_acquisition_mode := coalesce(v_acquisition_mode, 'auction');
  v_ownership_deductions_enabled := coalesce(v_ownership_deductions_enabled, true);

  delete from public.member_match_scores where fixture_id = p_fixture_id;
  with rule as (
    select rules.* from public.lineup_rule_sets rules
    where rules.id = public.lineup_rule_set_for_fixture(p_fixture_id)
  ), player_values as (
    select lineup.id lineup_id, lineup.member_id, lineup_player.player_id,
      case
        when lineup.impact_player_id = lineup_player.player_id and lineup.impact_type = 'BAI' then points.batting_points * rule.impact_multiplier
        when lineup.impact_player_id = lineup_player.player_id and lineup.impact_type = 'BOI' then points.bowling_points * rule.impact_multiplier
        else points.total_points
      end eligible_points,
      case when lineup.captain_player_id = lineup_player.player_id then rule.captain_multiplier
           when lineup.vice_captain_player_id = lineup_player.player_id then rule.vice_captain_multiplier else 1 end marker_multiplier,
      case when booster.code = '3X' and lineup_booster.target_player_id = lineup_player.player_id then booster.player_multiplier else 1 end booster_multiplier,
      v_ownership_deductions_enabled
        and league_player.owner_member_id is distinct from lineup.member_id borrowed,
      rule.other_owner_penalty_percent penalty_percent,
      rule.other_owner_minimum_penalty minimum_penalty,
      booster.code lineup_booster_code,
      booster.match_multiplier match_multiplier
    from public.lineup_submissions lineup
    join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
    join public.player_match_points points on points.fixture_id = lineup.fixture_id
      and points.player_id = lineup_player.player_id and points.calculation_version = v_calculation_version
    join public.league_players league_player on league_player.league_id = lineup.league_id and league_player.player_id = lineup_player.player_id
    cross join rule
    left join public.lineup_boosters lineup_booster on lineup_booster.lineup_id = lineup.id
    left join public.booster_rules booster on booster.id = lineup_booster.booster_rule_id
    where lineup.fixture_id = p_fixture_id and lineup.status in ('submitted', 'locked')
  ), owner_values as (
    select lineup_id, member_id,
      sum(eligible_points * marker_multiplier * booster_multiplier) gross_points,
      sum(case when borrowed and eligible_points * marker_multiplier * booster_multiplier > 0
        then greatest(eligible_points * marker_multiplier * booster_multiplier * penalty_percent / 100, minimum_penalty)
        else 0 end) ownership_penalty,
      max(lineup_booster_code) booster_code,
      max(match_multiplier) match_multiplier
    from player_values group by lineup_id, member_id
  ), final_values as (
    select *, (gross_points - ownership_penalty) * case when booster_code = '2UP' then coalesce(match_multiplier, 2) else 1 end final_points
    from owner_values
  )
  insert into public.member_match_scores (
    fixture_id, member_id, lineup_id, base_points,
    captain_bonus, vice_captain_bonus, impact_adjustment, ownership_adjustment,
    calculation_breakdown, published_at
  )
  select p_fixture_id, member_id, lineup_id, final_points, 0, 0, 0, 0,
    jsonb_build_object('gross_points', gross_points, 'ownership_penalty', ownership_penalty,
      'ownership_deductions_enabled', v_ownership_deductions_enabled,
      'acquisition_mode', v_acquisition_mode,
      'booster_code', booster_code, 'match_multiplier', case when booster_code = '2UP' then coalesce(match_multiplier, 2) else 1 end,
      'final_points', final_points, 'calculation_version', v_calculation_version), now()
  from final_values;
  get diagnostics v_member_count = row_count;

  with ranked as (
    select id, dense_rank() over (order by total_points desc)::integer match_rank
    from public.member_match_scores where fixture_id = p_fixture_id
  )
  update public.member_match_scores score set rank = ranked.match_rank
  from ranked where score.id = ranked.id;

  update public.player_match_points set published_at = now()
  where fixture_id = p_fixture_id and calculation_version = v_calculation_version;
  update public.lineup_submissions set status = 'locked', locked_at = coalesce(locked_at, now()), updated_at = now()
  where fixture_id = p_fixture_id and status = 'submitted';
  update public.fixtures set status = 'completed', scoring_status = case when v_was_published then 'corrected' else 'published' end, updated_at = now()
  where id = p_fixture_id;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_fixture.league_id, auth.uid(), case when v_was_published then 'match_scores_corrected' else 'match_scores_published' end,
    'fixture', p_fixture_id::text, jsonb_build_object('calculation_version', v_calculation_version,
      'member_count', v_member_count, 'acquisition_mode', v_acquisition_mode,
      'ownership_deductions_enabled', v_ownership_deductions_enabled));
  return jsonb_build_object('calculation_version', v_calculation_version, 'member_count', v_member_count,
    'scoring_status', case when v_was_published then 'corrected' else 'published' end,
    'acquisition_mode', v_acquisition_mode,
    'ownership_deductions_enabled', v_ownership_deductions_enabled);
end;
$$;

revoke all on function public.publish_match_scores(uuid) from public;
grant execute on function public.publish_match_scores(uuid) to authenticated;

commit;
