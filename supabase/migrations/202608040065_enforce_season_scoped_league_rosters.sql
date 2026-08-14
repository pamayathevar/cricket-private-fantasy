-- Keep player team/role identities scoped to the league season that selected
-- them. A player may legitimately move teams in a later IPL season, but two
-- identities for the same person must never be active in the same league.
begin;

create or replace function public.normalized_player_name(p_name text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select lower(regexp_replace(trim(replace(p_name, chr(160), ' ')), '\s+', ' ', 'g'));
$$;

do $$
begin
  if (
    select count(*)
    from public.leagues
    where slug = 'ipl-2026'
      and season_year = 2026
  ) <> 1 then
    raise exception 'Expected exactly one authoritative IPL 2026 league';
  end if;
end;
$$;

-- IPL 2026's original imported pool is the season authority. Later test
-- leagues may use the same global players table, but their active pool must
-- resolve each name to the same 2026 identity. This retires legacy identities
-- such as Shardul Thakur (LSG) while retaining Shardul Thakur (MI).
create temporary table stale_ipl2026_league_players on commit drop as
with authoritative_league as (
  select id
  from public.leagues
  where slug = 'ipl-2026'
    and season_year = 2026
),
authoritative_players as (
  select ranked.player_id, ranked.name_key
  from (
    select
      source.player_id,
      public.normalized_player_name(player.full_name) as name_key,
      row_number() over (
        partition by public.normalized_player_name(player.full_name)
        order by source.active desc, source.created_at, source.player_id
      ) as identity_rank
    from public.league_players source
    join authoritative_league league on league.id = source.league_id
    join public.players player on player.id = source.player_id
  ) ranked
  where ranked.identity_rank = 1
)
select
  candidate.id as league_player_id,
  candidate.league_id,
  candidate.player_id as stale_player_id,
  authority.player_id as canonical_player_id,
  candidate.owner_member_id,
  candidate.acquisition_type,
  candidate.acquisition_price,
  candidate.bid_price,
  candidate.acquired_at,
  stale_player.full_name,
  stale_team.code as stale_team,
  canonical_team.code as canonical_team
from public.league_players candidate
join public.leagues league on league.id = candidate.league_id
join public.players stale_player on stale_player.id = candidate.player_id
left join public.cricket_teams stale_team on stale_team.id = stale_player.team_id
join authoritative_players authority
  on authority.name_key = public.normalized_player_name(stale_player.full_name)
 and authority.player_id <> candidate.player_id
join public.players canonical_player on canonical_player.id = authority.player_id
left join public.cricket_teams canonical_team on canonical_team.id = canonical_player.team_id
where league.competition = 'Indian Premier League'
  and league.season_year = 2026
  and candidate.player_id <> authority.player_id
  and candidate.active;

-- If a target league has only the stale identity active, carry its league-level
-- owner and prices to the correct season identity before retiring the old row.
-- Existing canonical ownership/prices win when both rows were already active.
with replacement as (
  select distinct on (stale.league_id, stale.canonical_player_id)
    stale.*
  from stale_ipl2026_league_players stale
  order by
    stale.league_id,
    stale.canonical_player_id,
    (stale.owner_member_id is not null) desc,
    stale.league_player_id
)
insert into public.league_players as canonical (
  league_id,
  player_id,
  owner_member_id,
  acquisition_type,
  acquisition_price,
  bid_price,
  active,
  acquired_at,
  released_at
)
select
  replacement.league_id,
  replacement.canonical_player_id,
  replacement.owner_member_id,
  replacement.acquisition_type,
  replacement.acquisition_price,
  replacement.bid_price,
  true,
  replacement.acquired_at,
  null
from replacement
on conflict (league_id, player_id) do update
set
  owner_member_id = coalesce(canonical.owner_member_id, excluded.owner_member_id),
  acquisition_type = case
    when canonical.owner_member_id is not null then canonical.acquisition_type
    else excluded.acquisition_type
  end,
  acquisition_price = case
    when canonical.acquisition_price > 0 then canonical.acquisition_price
    else excluded.acquisition_price
  end,
  bid_price = coalesce(canonical.bid_price, excluded.bid_price),
  active = true,
  acquired_at = coalesce(canonical.acquired_at, excluded.acquired_at),
  released_at = null,
  updated_at = now();

insert into public.audit_events (
  league_id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data
)
select
  stale.league_id,
  null,
  'stale_season_player_deactivated',
  'league_player',
  stale.league_player_id::text,
  jsonb_build_object(
    'player_id', stale.stale_player_id,
    'full_name', stale.full_name,
    'team', stale.stale_team,
    'active', true
  ),
  jsonb_build_object(
    'player_id', stale.stale_player_id,
    'active', false,
    'canonical_player_id', stale.canonical_player_id,
    'canonical_team', stale.canonical_team,
    'reason', 'season_scoped_roster_identity'
  )
from stale_ipl2026_league_players stale;

update public.league_players league_player
set
  active = false,
  released_at = coalesce(league_player.released_at, now()),
  updated_at = now()
from stale_ipl2026_league_players stale
where league_player.id = stale.league_player_id;

create or replace function public.validate_active_league_player_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_conflict record;
begin
  if not new.active then
    return new;
  end if;

  select public.normalized_player_name(player.full_name)
  into v_name
  from public.players player
  where player.id = new.player_id;

  if v_name is null then
    raise exception 'Player record was not found';
  end if;

  select
    other_player.full_name,
    team.code as team_code
  into v_conflict
  from public.league_players other
  join public.players other_player on other_player.id = other.player_id
  left join public.cricket_teams team on team.id = other_player.team_id
  where other.league_id = new.league_id
    and other.active
    and other.id is distinct from new.id
    and public.normalized_player_name(other_player.full_name) = v_name
  limit 1;

  if found then
    raise exception
      'An active player named % already exists in this league for team %. Deactivate the old season identity before activating the new one.',
      v_conflict.full_name,
      coalesce(v_conflict.team_code, 'unassigned');
  end if;

  return new;
end;
$$;

drop trigger if exists validate_active_league_player_identity_before_write
on public.league_players;

create trigger validate_active_league_player_identity_before_write
before insert or update of league_id, player_id, active
on public.league_players
for each row execute function public.validate_active_league_player_identity();

-- Renaming a global player identity must not bypass the league-level guard.
create or replace function public.validate_player_rename_across_leagues()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.normalized_player_name(new.full_name) = public.normalized_player_name(old.full_name) then
    return new;
  end if;

  if exists (
    select 1
    from public.league_players current_entry
    join public.league_players other_entry
      on other_entry.league_id = current_entry.league_id
     and other_entry.active
     and other_entry.player_id <> current_entry.player_id
    join public.players other_player on other_player.id = other_entry.player_id
    where current_entry.player_id = old.id
      and current_entry.active
      and public.normalized_player_name(other_player.full_name) =
          public.normalized_player_name(new.full_name)
  ) then
    raise exception 'Renaming this player would create a duplicate active identity in a league';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_player_rename_across_leagues_before_write
on public.players;

create trigger validate_player_rename_across_leagues_before_write
before update of full_name
on public.players
for each row execute function public.validate_player_rename_across_leagues();

revoke all on function public.normalized_player_name(text) from public;
revoke all on function public.validate_active_league_player_identity() from public;
revoke all on function public.validate_player_rename_across_leagues() from public;

commit;
