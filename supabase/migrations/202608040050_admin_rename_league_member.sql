-- Allow league administrators to change an owner's league-specific display name.
begin;

create or replace function public.rename_league_member(
  p_league_id uuid,
  p_member_id uuid,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.league_members%rowtype;
  v_name text := trim(p_display_name);
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'League admin access required';
  end if;
  if nullif(v_name, '') is null then
    raise exception 'Owner display name is required';
  end if;
  if length(v_name) > 60 then
    raise exception 'Owner display name must be 60 characters or fewer';
  end if;

  select * into v_member
  from public.league_members
  where id = p_member_id and league_id = p_league_id
  for update;

  if v_member.id is null then
    raise exception 'League member was not found';
  end if;
  if v_member.display_name = v_name then
    return jsonb_build_object('member_id', v_member.id, 'display_name', v_name, 'changed', false);
  end if;

  -- The existing case-insensitive unique index and validation trigger provide
  -- the final concurrency-safe duplicate-name guard.
  update public.league_members
  set display_name = v_name, updated_at = now()
  where id = v_member.id;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_league_id, auth.uid(), 'league_member_renamed', 'league_member', v_member.id::text,
    jsonb_build_object('display_name', v_member.display_name),
    jsonb_build_object('display_name', v_name, 'email', v_member.email)
  );

  return jsonb_build_object('member_id', v_member.id, 'display_name', v_name, 'changed', true);
end;
$$;

revoke all on function public.rename_league_member(uuid, uuid, text) from public;
grant execute on function public.rename_league_member(uuid, uuid, text) to authenticated;

commit;
