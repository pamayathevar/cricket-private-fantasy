-- Serialize each owner's lineup submission chain and prevent authenticated
-- clients from bypassing transfer/reset enforcement through lower-level RPCs.
begin;

do $$
declare
  v_definition text;
  v_declare_anchor text := $anchor$  v_fixture public.fixtures%rowtype;$anchor$;
  v_declare_with_lock_context text := $replacement$  v_fixture public.fixtures%rowtype;
  v_submission_league_id uuid;
  v_submission_member_id uuid;$replacement$;
  v_begin_anchor text := $anchor$begin
  select * into v_fixture from public.fixtures where id = p_fixture_id for update;$anchor$;
  v_begin_with_lock text := $replacement$begin
  select fixture.league_id into v_submission_league_id
  from public.fixtures fixture
  where fixture.id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;

  v_submission_member_id := public.current_member_id(v_submission_league_id);
  if v_submission_member_id is null then raise exception 'Active league membership required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    v_submission_league_id::text || ':' || v_submission_member_id::text, 0
  ));

  select * into v_fixture from public.fixtures where id = p_fixture_id for update;$replacement$;
begin
  v_definition := pg_get_functiondef(
    'public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)'::regprocedure
  );

  if position('pg_advisory_xact_lock' in v_definition) = 0 then
    if position(v_declare_anchor in v_definition) = 0 then
      raise exception 'Could not locate lineup submission declaration block';
    end if;
    if position(v_begin_anchor in v_definition) = 0 then
      raise exception 'Could not locate lineup submission fixture lock';
    end if;
    v_definition := replace(v_definition, v_declare_anchor, v_declare_with_lock_context);
    v_definition := replace(v_definition, v_begin_anchor, v_begin_with_lock);
  end if;

  execute v_definition;
end;
$$;

revoke all on function public.submit_lineup(uuid, uuid[], uuid, uuid, uuid, text)
  from public, authenticated, anon;
revoke all on function public.submit_lineup_with_booster(uuid, uuid[], uuid, uuid, uuid, text, text, uuid)
  from public, authenticated, anon;

revoke all on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid)
  from public, anon;
grant execute on function public.submit_lineup_with_transfer_enforcement(uuid, uuid[], uuid, uuid, uuid, text, text, uuid)
  to authenticated;

commit;
