-- All Open Players leagues must never assign squad players to owners.
begin;

create or replace function public.validate_league_player_ownership_mode()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ownership_enabled boolean;
begin
  select ownership_enabled into v_ownership_enabled
  from public.league_format_configs
  where league_id = new.league_id;

  if coalesce(v_ownership_enabled, true) = false
     and new.owner_member_id is not null then
    raise exception 'Owner assignment is not allowed in an All Open Players league';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_league_player_ownership_mode_before_write
on public.league_players;

create trigger validate_league_player_ownership_mode_before_write
before insert or update of owner_member_id, league_id
on public.league_players
for each row execute function public.validate_league_player_ownership_mode();

-- Normalize any invalid rows created before this guard was installed.
update public.league_players league_player
set
  owner_member_id = null,
  acquisition_type = 'open',
  bid_price = null,
  acquired_at = null,
  updated_at = now()
from public.league_format_configs format
where format.league_id = league_player.league_id
  and not format.ownership_enabled
  and league_player.owner_member_id is not null;

commit;
