-- Keep superseded publishing helpers internal so clients always pass through
-- the current validation wrappers.
begin;

do $$
declare
  v_definition text;
  v_unlocked_lookup text := $old$  select * into v_fixture from public.fixtures where id = p_fixture_id;$old$;
  v_locked_lookup text := $new$  select * into v_fixture from public.fixtures where id = p_fixture_id for update;$new$;
begin
  v_definition := pg_get_functiondef('public.publish_match_scores_safe(uuid)'::regprocedure);
  if position(v_unlocked_lookup in v_definition) > 0 then
    execute replace(v_definition, v_unlocked_lookup, v_locked_lookup);
  elsif position(v_locked_lookup in v_definition) = 0 then
    raise exception 'Could not locate the safe publication fixture lookup';
  end if;
end;
$$;

revoke all on function public.publish_match_scores(uuid)
  from public, authenticated, anon;
revoke all on function public.publish_league_rules(uuid, jsonb, jsonb)
  from public, authenticated, anon;
revoke all on function public.publish_special_player_rules(uuid, integer, jsonb)
  from public, authenticated, anon;
revoke all on function public.update_league_transfer_limits(uuid, integer, integer)
  from public, authenticated, anon;

revoke all on function public.publish_match_scores_safe(uuid)
  from public, anon;
grant execute on function public.publish_match_scores_safe(uuid)
  to authenticated;

revoke all on function public.publish_league_rules_effective(uuid, jsonb, jsonb, integer, integer)
  from public, anon;
grant execute on function public.publish_league_rules_effective(uuid, jsonb, jsonb, integer, integer)
  to authenticated;

revoke all on function public.publish_special_player_rules_v2(uuid, integer, jsonb)
  from public, anon;
grant execute on function public.publish_special_player_rules_v2(uuid, integer, jsonb)
  to authenticated;

commit;
