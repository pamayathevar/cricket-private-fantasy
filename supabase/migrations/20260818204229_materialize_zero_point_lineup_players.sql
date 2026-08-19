-- Owner XIs can contain players who were not part of this fixture's verified
-- scorecard (including players from other IPL teams and non-playing squad
-- members). Materialize explicit zero rows for those selected players at the
-- guarded publication boundary so every submitted XI is evaluated completely.
begin;

do $migration$
declare
  v_definition text;
  v_anchor text := $anchor$  select count(*) into v_missing
  from public.lineup_submissions lineup
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  where lineup.fixture_id = p_fixture_id
    and lineup.status in ('submitted', 'locked')
    and not exists (
      select 1 from public.player_match_points points
      where points.fixture_id = p_fixture_id
        and points.player_id = lineup_player.player_id
        and points.calculation_version = v_calculation_version
    );$anchor$;
  v_replacement text := $replacement$  if v_calculation_version is null then
    raise exception 'No calculated player points found';
  end if;

  insert into public.player_match_points (
    fixture_id, player_id, rule_set_id, raw_stats, breakdown,
    batting_points, bowling_points, fielding_points, bonus_points,
    calculation_version, calculated_at, published_at
  )
  select distinct p_fixture_id, lineup_player.player_id,
    (
      select points.rule_set_id
      from public.player_match_points points
      where points.fixture_id = p_fixture_id
        and points.calculation_version = v_calculation_version
      order by points.player_id
      limit 1
    ),
    jsonb_build_object(
      'automatic_zero', true,
      'reason', 'selected_player_absent_from_verified_scorecard'
    ),
    jsonb_build_object(
      'automatic_zero', true,
      'reason', 'selected_player_absent_from_verified_scorecard'
    ),
    0, 0, 0, 0, v_calculation_version, now(), null::timestamptz
  from public.lineup_submissions lineup
  join public.lineup_players lineup_player on lineup_player.lineup_id = lineup.id
  where lineup.fixture_id = p_fixture_id
    and lineup.status in ('submitted', 'locked')
    and not exists (
      select 1 from public.player_match_points points
      where points.fixture_id = p_fixture_id
        and points.player_id = lineup_player.player_id
        and points.calculation_version = v_calculation_version
    )
  on conflict (fixture_id, player_id, calculation_version) do nothing;

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
    );$replacement$;
begin
  v_definition := pg_get_functiondef('public.publish_match_scores_safe(uuid)'::regprocedure);
  if position(v_anchor in v_definition) = 0 then
    if position('selected_player_absent_from_verified_scorecard' in v_definition) > 0 then
      return;
    end if;
    raise exception 'Could not locate the selected-player validation in publish_match_scores_safe';
  end if;
  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

revoke all on function public.publish_match_scores_safe(uuid)
  from public, anon;
grant execute on function public.publish_match_scores_safe(uuid)
  to authenticated;

commit;
