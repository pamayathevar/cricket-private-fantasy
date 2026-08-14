-- Keep season membership separate from temporary player availability.
-- A legitimate player may be inactive/withdrawn for the current season and
-- should remain visible in Player Pool. A stale identity copied from another
-- season must be hidden and must never be reactivated in this league.
begin;

alter table public.league_players
add column if not exists season_eligible boolean not null default true;

-- Migration 065 recorded every cross-season identity it retired. Convert that
-- durable audit classification into an explicit roster eligibility flag.
update public.league_players league_player
set season_eligible = false,
    active = false,
    released_at = coalesce(league_player.released_at, now()),
    updated_at = now()
where exists (
  select 1
  from public.audit_events audit
  where audit.league_id = league_player.league_id
    and audit.action = 'stale_season_player_deactivated'
    and audit.entity_type = 'league_player'
    and audit.entity_id = league_player.id::text
    and audit.after_data ->> 'reason' = 'season_scoped_roster_identity'
);

-- Also classify every retained IPL 2026 duplicate, including inactive legacy
-- rows that migration 065 deliberately left untouched. The original IPL 2026
-- league remains the authority and its active identity wins for each name.
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
update public.league_players league_player
set season_eligible = false,
    active = false,
    released_at = coalesce(league_player.released_at, now()),
    updated_at = now()
from public.leagues league,
     public.players player,
     authoritative_players authority
where league_player.league_id = league.id
  and league_player.player_id = player.id
  and league.competition = 'Indian Premier League'
  and league.season_year = 2026
  and authority.name_key = public.normalized_player_name(player.full_name)
  and authority.player_id <> league_player.player_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'league_players_active_requires_season_eligibility'
      and conrelid = 'public.league_players'::regclass
  ) then
    alter table public.league_players
    add constraint league_players_active_requires_season_eligibility
    check (not active or season_eligible);
  end if;
end;
$$;

create index if not exists league_players_season_roster_idx
on public.league_players (league_id, player_id)
where season_eligible;

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

  if not new.season_eligible then
    raise exception 'This player identity does not belong to this league season';
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
    and other.season_eligible
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

revoke all on function public.validate_active_league_player_identity() from public;

commit;
