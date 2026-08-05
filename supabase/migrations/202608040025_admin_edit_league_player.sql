-- Allow a league administrator to correct league-player details without reopening bidding.
begin;

create or replace function public.edit_league_player(
  p_league_player_id uuid,
  p_full_name text,
  p_role text,
  p_selection_cost numeric,
  p_owner_member_id uuid,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_league_player public.league_players%rowtype;
  v_player public.players%rowtype;
  v_owner_name text;
  v_before jsonb;
begin
  select * into v_league_player
  from public.league_players
  where id = p_league_player_id
  for update;

  if v_league_player.id is null then
    raise exception 'League player was not found';
  end if;
  if not public.is_league_admin(v_league_player.league_id) then
    raise exception 'League admin access required';
  end if;
  if nullif(trim(p_full_name), '') is null then
    raise exception 'Player name is required';
  end if;
  if p_role not in ('BA', 'BO', 'WK', 'AL') then
    raise exception 'Role must be BA, BO, WK or AL';
  end if;
  if p_selection_cost is null or p_selection_cost < 0 then
    raise exception 'Selection cost must be zero or greater';
  end if;
  if p_active is null then
    raise exception 'Active status is required';
  end if;

  select * into v_player from public.players where id = v_league_player.player_id;
  if v_player.id is null then
    raise exception 'Player record was not found';
  end if;

  if exists (
    select 1
    from public.players other_player
    where other_player.team_id = v_player.team_id
      and lower(trim(other_player.full_name)) = lower(trim(p_full_name))
      and other_player.id <> v_player.id
  ) then
    raise exception 'Another player with this name already exists in the IPL team';
  end if;

  if p_owner_member_id is not null then
    select display_name into v_owner_name
    from public.league_members
    where id = p_owner_member_id
      and league_id = v_league_player.league_id
      and status = 'active'
      and role in ('owner', 'league_admin');
    if v_owner_name is null then
      raise exception 'Selected owner is not active in this league';
    end if;
  end if;

  v_before := jsonb_build_object(
    'full_name', v_player.full_name,
    'role', v_player.role,
    'selection_cost', v_league_player.acquisition_price,
    'owner_member_id', v_league_player.owner_member_id,
    'active', v_league_player.active,
    'bid_price', v_league_player.bid_price
  );

  update public.players
  set full_name = trim(p_full_name), role = p_role, updated_at = now()
  where id = v_player.id;

  update public.league_players
  set owner_member_id = p_owner_member_id,
      acquisition_type = case
        when p_owner_member_id is null then 'open'
        when p_owner_member_id is distinct from v_league_player.owner_member_id then 'admin'
        else v_league_player.acquisition_type
      end,
      acquisition_price = p_selection_cost,
      active = p_active,
      acquired_at = case when p_owner_member_id is null then null else coalesce(acquired_at, now()) end,
      released_at = case when p_active then null else coalesce(released_at, now()) end,
      updated_at = now()
  where id = p_league_player_id;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    v_league_player.league_id, auth.uid(), 'league_player_edited', 'league_player',
    p_league_player_id::text, v_before,
    jsonb_build_object(
      'full_name', trim(p_full_name),
      'role', p_role,
      'selection_cost', p_selection_cost,
      'owner_member_id', p_owner_member_id,
      'owner_name', v_owner_name,
      'active', p_active,
      'bid_price', v_league_player.bid_price
    )
  );

  return jsonb_build_object(
    'league_player_id', p_league_player_id,
    'full_name', trim(p_full_name),
    'role', p_role,
    'selection_cost', p_selection_cost,
    'owner_member_id', p_owner_member_id,
    'owner_name', v_owner_name,
    'active', p_active,
    'bid_price', v_league_player.bid_price
  );
end;
$$;

revoke all on function public.edit_league_player(uuid, text, text, numeric, uuid, boolean) from public;
grant execute on function public.edit_league_player(uuid, text, text, numeric, uuid, boolean) to authenticated;

commit;
