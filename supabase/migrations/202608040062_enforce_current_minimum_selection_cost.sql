-- Replacement-player and admin-edit selection costs must respect the current
-- positive minimum among active IPL players in the same league.
begin;

create or replace function public.current_ipl_minimum_selection_cost(p_league_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select min(lp.acquisition_price)
  from public.league_players lp
  join public.players player on player.id = lp.player_id
  join public.cricket_teams team on team.id = player.team_id
  where lp.league_id = p_league_id
    and lp.active
    and player.active
    and team.active
    and lp.acquisition_price > 0;
$$;

alter function public.add_league_replacement_player(uuid, text, text, text, numeric, uuid)
  rename to add_league_replacement_player_unchecked;

create function public.add_league_replacement_player(
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
  v_minimum numeric;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'League admin access required';
  end if;

  v_minimum := public.current_ipl_minimum_selection_cost(p_league_id);
  if v_minimum is null then
    raise exception 'Current IPL minimum selection cost could not be determined';
  end if;
  if p_selection_cost is null or p_selection_cost < v_minimum then
    raise exception 'Selection cost cannot be below the current IPL minimum of ₹%m', trim(to_char(v_minimum, 'FM999999990.0'));
  end if;

  return public.add_league_replacement_player_unchecked(
    p_league_id,
    p_team_code,
    p_full_name,
    p_role,
    p_selection_cost,
    p_owner_member_id
  );
end;
$$;

alter function public.edit_league_player(uuid, text, text, numeric, uuid, boolean)
  rename to edit_league_player_unchecked;

create function public.edit_league_player(
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
  v_league_id uuid;
  v_minimum numeric;
begin
  select league_id into v_league_id
  from public.league_players
  where id = p_league_player_id;

  if v_league_id is null then
    raise exception 'League player was not found';
  end if;
  if not public.is_league_admin(v_league_id) then
    raise exception 'League admin access required';
  end if;

  v_minimum := public.current_ipl_minimum_selection_cost(v_league_id);
  if v_minimum is null then
    raise exception 'Current IPL minimum selection cost could not be determined';
  end if;
  if p_selection_cost is null or p_selection_cost < v_minimum then
    raise exception 'Selection cost cannot be below the current IPL minimum of ₹%m', trim(to_char(v_minimum, 'FM999999990.0'));
  end if;

  return public.edit_league_player_unchecked(
    p_league_player_id,
    p_full_name,
    p_role,
    p_selection_cost,
    p_owner_member_id,
    p_active
  );
end;
$$;

revoke all on function public.current_ipl_minimum_selection_cost(uuid) from public, anon, authenticated;
revoke all on function public.add_league_replacement_player_unchecked(uuid, text, text, text, numeric, uuid) from public, anon, authenticated;
revoke all on function public.edit_league_player_unchecked(uuid, text, text, numeric, uuid, boolean) from public, anon, authenticated;
revoke all on function public.add_league_replacement_player(uuid, text, text, text, numeric, uuid) from public, anon;
revoke all on function public.edit_league_player(uuid, text, text, numeric, uuid, boolean) from public, anon;
grant execute on function public.add_league_replacement_player(uuid, text, text, text, numeric, uuid) to authenticated;
grant execute on function public.edit_league_player(uuid, text, text, numeric, uuid, boolean) to authenticated;

commit;
