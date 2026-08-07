-- Repair the three remote-test leagues that were repurposed from older test
-- leagues. Their fixtures and labels were changed to IPL 2026, but the Open
-- Players league still retained an IPL 2025 squad (for example Andre Russell).
--
-- The real IPL 2026 league is the canonical roster. Auction ownership and bid
-- prices are mapped to each target league by member email. The All Open league
-- always receives null ownership and null bid prices.
begin;

create temporary table target_remote_leagues on commit drop as
select
  league.id,
  league.name,
  format.acquisition_mode
from public.leagues league
join public.league_format_configs format on format.league_id = league.id
where league.slug in (
  'ipl-2026-open-test',
  'ipl-2026-unique-test',
  'ipl-2026-royalty-test'
);

do $$
begin
  if not exists (select 1 from public.leagues where slug = 'ipl-2026') then
    raise exception 'Canonical IPL 2026 league does not exist';
  end if;

  if (select count(*) from target_remote_leagues) <> 3 then
    raise exception 'Expected all three IPL 2026 remote-test leagues';
  end if;
end;
$$;

-- Remove league-specific roster rows inherited from IPL 2025. Global player
-- records and any historical lineup rows remain untouched.
delete from public.league_players target_player
using target_remote_leagues target
where target_player.league_id = target.id
  and not exists (
    select 1
    from public.league_players canonical_player
    join public.leagues canonical_league
      on canonical_league.id = canonical_player.league_id
     and canonical_league.slug = 'ipl-2026'
    where canonical_player.player_id = target_player.player_id
  );

-- Copy every canonical IPL 2026 player and its current availability. Owners
-- are resolved inside each target league so foreign league-member IDs are
-- never copied directly.
insert into public.league_players as existing (
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
  target.id,
  canonical_player.player_id,
  case
    when target.acquisition_mode = 'all_open' then null
    else target_owner.id
  end,
  case
    when target.acquisition_mode = 'all_open' then 'open'
    else canonical_player.acquisition_type
  end,
  canonical_player.acquisition_price,
  case
    when target.acquisition_mode = 'all_open' then null
    else canonical_player.bid_price
  end,
  canonical_player.active,
  case
    when target.acquisition_mode = 'all_open' then null
    else canonical_player.acquired_at
  end,
  canonical_player.released_at
from target_remote_leagues target
join public.leagues canonical_league on canonical_league.slug = 'ipl-2026'
join public.league_players canonical_player
  on canonical_player.league_id = canonical_league.id
left join public.league_members canonical_owner
  on canonical_owner.id = canonical_player.owner_member_id
left join public.league_members target_owner
  on target_owner.league_id = target.id
 and lower(target_owner.email::text) = lower(canonical_owner.email::text)
on conflict (league_id, player_id) do update
set owner_member_id = excluded.owner_member_id,
    acquisition_type = excluded.acquisition_type,
    acquisition_price = excluded.acquisition_price,
    bid_price = excluded.bid_price,
    active = excluded.active,
    acquired_at = excluded.acquired_at,
    released_at = excluded.released_at,
    updated_at = now();

commit;

-- Verification: all rows should be PASS. KKR must contain 29 official records,
-- 24 active records and no Andre Russell league-player row.
with canonical as (
  select
    team.code as team_code,
    count(*) as players,
    count(*) filter (where league_player.active) as active_players
  from public.leagues league
  join public.league_players league_player on league_player.league_id = league.id
  join public.players player on player.id = league_player.player_id
  join public.cricket_teams team on team.id = player.team_id
  where league.slug = 'ipl-2026'
  group by team.code
),
target as (
  select
    league.name as league_name,
    league.slug,
    team.code as team_code,
    count(*) as players,
    count(*) filter (where league_player.active) as active_players,
    count(*) filter (where lower(player.full_name) = 'andre russell') as andre_russell_rows
  from public.leagues league
  join public.league_players league_player on league_player.league_id = league.id
  join public.players player on player.id = league_player.player_id
  join public.cricket_teams team on team.id = player.team_id
  where league.slug in (
    'ipl-2026-open-test',
    'ipl-2026-unique-test',
    'ipl-2026-royalty-test'
  )
  group by league.id, league.name, league.slug, team.code
)
select
  target.league_name,
  target.team_code,
  target.players,
  canonical.players as expected_players,
  target.active_players,
  canonical.active_players as expected_active,
  target.andre_russell_rows,
  case
    when target.players = canonical.players
     and target.active_players = canonical.active_players
     and target.andre_russell_rows = 0
    then 'PASS'
    else 'FAIL'
  end as status
from target
join canonical using (team_code)
order by target.league_name, target.team_code;
