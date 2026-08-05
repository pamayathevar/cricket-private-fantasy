-- Allow league administrators to deactivate/reactivate an IPL player for one league.
-- Deactivation affects future lineup validation only; historical lineups and points remain intact.
begin;

create or replace function public.set_league_player_active(
  p_league_player_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player public.league_players%rowtype;
begin
  select * into v_player
  from public.league_players
  where id = p_league_player_id
  for update;

  if not found then
    raise exception 'League player was not found';
  end if;
  if not public.is_league_admin(v_player.league_id) then
    raise exception 'League admin access required';
  end if;

  if v_player.active is distinct from p_active then
    update public.league_players
    set active = p_active,
        released_at = case when p_active then null else now() end,
        updated_at = now()
    where id = p_league_player_id;

    insert into public.audit_events (
      league_id, actor_user_id, action, entity_type, entity_id,
      before_data, after_data
    ) values (
      v_player.league_id,
      auth.uid(),
      case when p_active then 'league_player_reactivated' else 'league_player_deactivated' end,
      'league_player',
      p_league_player_id::text,
      jsonb_build_object('active', v_player.active),
      jsonb_build_object('active', p_active)
    );
  end if;

  return jsonb_build_object(
    'league_player_id', p_league_player_id,
    'active', p_active
  );
end;
$$;

revoke all on function public.set_league_player_active(uuid, boolean) from public;
grant execute on function public.set_league_player_active(uuid, boolean) to authenticated;

commit;
