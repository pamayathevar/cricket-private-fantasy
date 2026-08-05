-- Admin-only, audited league-format publishing during draft setup.
begin;

create or replace function public.publish_league_format(
  p_league_id uuid,
  p_acquisition_mode text,
  p_bidding_enabled boolean,
  p_other_owner_deductions_enabled boolean,
  p_marquee_enabled boolean,
  p_unique_players_enabled boolean,
  p_unique_scope text,
  p_royalty_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.league_format_configs%rowtype;
  v_after public.league_format_configs%rowtype;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'League admin access required';
  end if;
  if p_acquisition_mode not in ('auction', 'all_open') then
    raise exception 'Acquisition mode must be auction or all_open';
  end if;
  if p_unique_players_enabled and p_unique_scope not in ('match', 'phase', 'league') then
    raise exception 'Unique-player scope must be match, phase or league';
  end if;
  if p_acquisition_mode = 'all_open' and exists (
    select 1 from public.league_players
    where league_id = p_league_id
      and (owner_member_id is not null or bid_price is not null)
  ) then
    raise exception 'All Open requires every league player to be OpenPlayer with no bid price';
  end if;

  select * into v_before from public.league_format_configs
  where league_id = p_league_id for update;
  if v_before.league_id is null then raise exception 'League format configuration not found'; end if;

  update public.league_format_configs
  set acquisition_mode = p_acquisition_mode,
      ownership_enabled = p_acquisition_mode = 'auction',
      bidding_enabled = case when p_acquisition_mode = 'auction' then coalesce(p_bidding_enabled, false) else false end,
      other_owner_deductions_enabled = case when p_acquisition_mode = 'auction' then coalesce(p_other_owner_deductions_enabled, false) else false end,
      marquee_enabled = coalesce(p_marquee_enabled, false),
      unique_players_enabled = coalesce(p_unique_players_enabled, false),
      unique_scope = case when p_unique_players_enabled then p_unique_scope else null end,
      royalty_enabled = coalesce(p_royalty_enabled, false),
      setup_status = 'published'
  where league_id = p_league_id
  returning * into v_after;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (p_league_id, auth.uid(), 'league_format_published', 'league_format', p_league_id::text,
    to_jsonb(v_before) - 'created_at' - 'updated_at', to_jsonb(v_after) - 'created_at' - 'updated_at');

  return jsonb_build_object(
    'acquisition_mode', v_after.acquisition_mode,
    'ownership_enabled', v_after.ownership_enabled,
    'bidding_enabled', v_after.bidding_enabled,
    'other_owner_deductions_enabled', v_after.other_owner_deductions_enabled,
    'marquee_enabled', v_after.marquee_enabled,
    'unique_players_enabled', v_after.unique_players_enabled,
    'unique_scope', v_after.unique_scope,
    'royalty_enabled', v_after.royalty_enabled
  );
end;
$$;

revoke all on function public.publish_league_format(uuid,text,boolean,boolean,boolean,boolean,text,boolean) from public;
grant execute on function public.publish_league_format(uuid,text,boolean,boolean,boolean,boolean,text,boolean) to authenticated;

commit;
