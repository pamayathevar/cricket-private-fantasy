-- QA setup for Unique/Marquee phase-selection testing.
-- First create a league from the IPL 2026 template in the app with slug:
--   special-rules-test-2028
-- This script copies test membership, squad ownership and fixtures only.
-- It does not copy lineups, transfers, player points or owner scores.

begin;

do $$
declare
  v_source_id uuid := '10000000-0000-4000-8000-000000002026';
  v_target_id uuid;
begin
  select id into v_target_id from public.leagues where slug = 'special-rules-test-2028';
  if v_target_id is null then
    raise exception 'Create the target league with slug special-rules-test-2028 from the IPL 2026 template first';
  end if;

  if exists (select 1 from public.lineup_submissions where league_id = v_target_id) then
    raise exception 'Target league already has lineups; use a clean test league';
  end if;

  -- Templates may already have invitations. Activate/link those records by
  -- email or normalized owner name before inserting genuinely missing owners.
  update public.league_members target
  set user_id = coalesce(source.user_id, target.user_id),
      role = source.role,
      status = 'active',
      joined_at = coalesce(target.joined_at, now()),
      responded_at = now(),
      participation_metadata = target.participation_metadata
        || jsonb_build_object('qa_source_league_id', v_source_id)
  from public.league_members source
  where source.league_id = v_source_id
    and target.league_id = v_target_id
    and (
      lower(target.email::text) = lower(source.email::text)
      or lower(trim(target.display_name)) = lower(trim(source.display_name))
    );

  insert into public.league_members (
    league_id, user_id, email, display_name, role, status,
    joined_at, invited_at, responded_at, participation_metadata
  )
  select
    v_target_id, source.user_id, source.email, source.display_name,
    source.role, 'active', now(), now(), now(),
    jsonb_build_object('qa_source_league_id', v_source_id)
  from public.league_members source
  where source.league_id = v_source_id
    and not exists (
      select 1 from public.league_members target
      where target.league_id = v_target_id
        and (
          lower(target.email::text) = lower(source.email::text)
          or lower(trim(target.display_name)) = lower(trim(source.display_name))
        )
    );

  update public.league_format_configs
  set acquisition_mode = 'auction',
      ownership_enabled = true,
      bidding_enabled = false,
      other_owner_deductions_enabled = true,
      setup_status = 'published',
      updated_at = now()
  where league_id = v_target_id;

  insert into public.league_players (
    league_id, player_id, owner_member_id, acquisition_type,
    acquisition_price, bid_price, active, acquired_at
  )
  select
    v_target_id,
    source_player.player_id,
    target_owner.id,
    case when target_owner.id is null then 'open' else 'auction' end,
    source_player.acquisition_price,
    source_player.bid_price,
    source_player.active,
    case when target_owner.id is null then null else now() end
  from public.league_players source_player
  left join public.league_members source_owner on source_owner.id = source_player.owner_member_id
  left join public.league_members target_owner
    on target_owner.league_id = v_target_id
   and (
     lower(target_owner.email::text) = lower(source_owner.email::text)
     or lower(trim(target_owner.display_name)) = lower(trim(source_owner.display_name))
   )
  where source_player.league_id = v_source_id
  on conflict (league_id, player_id) do update
  set owner_member_id = excluded.owner_member_id,
      acquisition_type = excluded.acquisition_type,
      acquisition_price = excluded.acquisition_price,
      bid_price = excluded.bid_price,
      active = excluded.active,
      acquired_at = excluded.acquired_at,
      released_at = null,
      updated_at = now();

  insert into public.fixtures (
    league_id, external_ref, match_number, stage, home_team_id, away_team_id,
    scheduled_start, lineup_lock_at, venue, status, scoring_status, scorecard_source_url
  )
  select
    v_target_id,
    'special-rules-test-2028-m' || lpad(source.match_number::text, 2, '0'),
    source.match_number,
    source.stage,
    source.home_team_id,
    source.away_team_id,
    date_trunc('day', now()) + interval '3 days 14 hours'
      + ((source.match_number - 1) * interval '1 day'),
    date_trunc('day', now()) + interval '3 days 14 hours'
      + ((source.match_number - 1) * interval '1 day'),
    source.venue,
    'scheduled',
    'pending',
    null
  from public.fixtures source
  where source.league_id = v_source_id
  on conflict (league_id, match_number) do update
  set home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      scheduled_start = excluded.scheduled_start,
      lineup_lock_at = excluded.lineup_lock_at,
      venue = excluded.venue,
      status = 'scheduled',
      scoring_status = 'pending',
      scorecard_source_url = null,
      updated_at = now();

  update public.leagues set status = 'active', updated_at = now() where id = v_target_id;
end
$$;

commit;

select
  league.name,
  format.acquisition_mode,
  format.ownership_enabled,
  (select count(*) from public.league_members member where member.league_id = league.id and member.status = 'active') as active_members,
  (select count(*) from public.league_players player where player.league_id = league.id) as squad_players,
  (select count(*) from public.league_players player where player.league_id = league.id and player.owner_member_id is not null) as owned_players,
  (select count(*) from public.fixtures fixture where fixture.league_id = league.id) as fixtures,
  (select min(fixture.lineup_lock_at) from public.fixtures fixture where fixture.league_id = league.id) as first_lock
from public.leagues league
join public.league_format_configs format on format.league_id = league.id
where league.slug = 'special-rules-test-2028';
