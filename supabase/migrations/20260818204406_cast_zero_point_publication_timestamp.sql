-- The SELECT feeding player_match_points uses DISTINCT, so PostgreSQL needs
-- the unpublished timestamp NULL to be explicitly typed.
begin;

do $migration$
declare
  v_definition text;
  v_untyped text := $old$v_calculation_version, now(), null
  from public.lineup_submissions$old$;
  v_typed text := $new$v_calculation_version, now(), null::timestamptz
  from public.lineup_submissions$new$;
begin
  v_definition := pg_get_functiondef('public.publish_match_scores_safe(uuid)'::regprocedure);
  if position(v_untyped in v_definition) > 0 then
    execute replace(v_definition, v_untyped, v_typed);
  elsif position(v_typed in v_definition) = 0 then
    raise exception 'Could not locate the automatic zero publication timestamp';
  end if;
end;
$migration$;

revoke all on function public.publish_match_scores_safe(uuid)
  from public, anon;
grant execute on function public.publish_match_scores_safe(uuid)
  to authenticated;

commit;
