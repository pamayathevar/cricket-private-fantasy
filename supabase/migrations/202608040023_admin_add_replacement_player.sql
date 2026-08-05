-- Add a replacement player to one league without changing other leagues.
begin;

create or replace function public.add_league_replacement_player(
  p_league_id uuid,
  p_team_code text,
  p_full_name text,
  p_role text,
  p_selection_cost numeric,
  p_owner_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_id uuid;
  v_player_id uuid;
  v_league_player_id uuid;
  v_owner_name text;
begin
  if not public.is_league_admin(p_league_id) then
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

  select id into v_team_id
  from public.cricket_teams
  where code = upper(trim(p_team_code)) and active;
  if v_team_id is null then
    raise exception 'Active IPL team % was not found', upper(trim(p_team_code));
  end if;

  if p_owner_member_id is not null then
    select display_name into v_owner_name
    from public.league_members
    where id = p_owner_member_id
      and league_id = p_league_id
      and status = 'active'
      and role in ('owner', 'league_admin');
    if v_owner_name is null then
      raise exception 'Selected owner is not active in this league';
    end if;
  end if;

  select id into v_player_id
  from public.players
  where team_id = v_team_id and lower(full_name) = lower(trim(p_full_name))
  limit 1;

  if v_player_id is null then
    insert into public.players (full_name, team_id, role, active)
    values (trim(p_full_name), v_team_id, p_role, true)
    returning id into v_player_id;
  else
    update public.players
    set role = p_role, active = true, updated_at = now()
    where id = v_player_id;
  end if;

  if exists (
    select 1 from public.league_players
    where league_id = p_league_id and player_id = v_player_id
  ) then
    raise exception 'Player already exists in this league; reactivate the existing player instead';
  end if;

  insert into public.league_players (
    league_id, player_id, owner_member_id, acquisition_type,
    acquisition_price, active, acquired_at, released_at
  ) values (
    p_league_id, v_player_id, p_owner_member_id,
    case when p_owner_member_id is null then 'open' else 'admin' end,
    p_selection_cost, true,
    case when p_owner_member_id is null then null else now() end,
    null
  ) returning id into v_league_player_id;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_league_id, auth.uid(), 'replacement_player_added', 'league_player',
    v_league_player_id::text,
    jsonb_build_object(
      'player_id', v_player_id,
      'full_name', trim(p_full_name),
      'team_code', upper(trim(p_team_code)),
      'role', p_role,
      'selection_cost', p_selection_cost,
      'owner_member_id', p_owner_member_id,
      'owner_name', v_owner_name
    )
  );

  return jsonb_build_object(
    'league_player_id', v_league_player_id,
    'player_id', v_player_id,
    'full_name', trim(p_full_name),
    'team_code', upper(trim(p_team_code)),
    'active', true
  );
end;
$$;

revoke all on function public.add_league_replacement_player(uuid, text, text, text, numeric, uuid) from public;
grant execute on function public.add_league_replacement_player(uuid, text, text, text, numeric, uuid) to authenticated;

commit;
