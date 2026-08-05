-- Read-only verification of the existing IPL 2027 template test.
with
source_league as (select id from public.leagues where slug = 'ipl-2026'),
target_league as (
  select id, slug, name, status
  from public.leagues
  where slug = 'ipl-2027'
     or (season_year = 2027 and (
       lower(name) = 'ipl 2027'
       or competition ilike '%indian premier league%'
       or competition ilike '%ipl%'
     ))
),
checks as (
  select 1 as n, 'IPL 2027 exists' as test_name,
    count(*) = 1 as passed,
    coalesce(max(slug || ' · ' || name), 'missing') as detail
  from target_league

  union all select 2, 'format copied',
    (select (to_jsonb(t) - 'league_id' - 'created_by' - 'created_at' - 'updated_at' - 'locked_at' - 'setup_status')
          = (to_jsonb(s) - 'league_id' - 'created_by' - 'created_at' - 'updated_at' - 'locked_at' - 'setup_status')
     from public.league_format_configs s cross join public.league_format_configs t
     where s.league_id = (select id from source_league) and t.league_id = (select id from target_league)),
    'league modes and feature flags'

  union all select 3, 'playing rules copied',
    (select (to_jsonb(t) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'version' - 'name' - 'effective_from_match_number')
          = (to_jsonb(s) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'version' - 'name' - 'effective_from_match_number')
     from public.lineup_rule_sets s cross join public.lineup_rule_sets t
     where s.league_id = (select id from source_league) and s.active
       and t.league_id = (select id from target_league) and t.active),
    'active rule values'

  union all select 4, 'points rules copied',
    (select t.rules = s.rules from public.scoring_rule_sets s cross join public.scoring_rule_sets t
     where s.league_id = (select id from source_league) and s.active
       and t.league_id = (select id from target_league) and t.active),
    'active scoring JSON'

  union all select 5, 'phase count copied',
    (select count(*) from public.league_phases where league_id = (select id from target_league) and active)
      = (select count(*) from public.league_phases where league_id = (select id from source_league) and active),
    (select count(*)::text from public.league_phases where league_id = (select id from target_league) and active)

  union all select 6, 'transfer-period count copied',
    (select count(*) from public.league_transfer_periods where league_id = (select id from target_league) and active)
      = (select count(*) from public.league_transfer_periods where league_id = (select id from source_league) and active),
    (select count(*)::text from public.league_transfer_periods where league_id = (select id from target_league) and active)

  union all select 7, 'booster count copied',
    (select count(*) from public.booster_rules where league_id = (select id from target_league) and active)
      = (select count(*) from public.booster_rules where league_id = (select id from source_league) and active),
    (select count(*)::text from public.booster_rules where league_id = (select id from target_league) and active)

  union all select 8, '74 fixtures imported separately',
    ((select count(*) from public.fixtures where league_id = (select id from target_league)) = 74),
    (select count(*)::text from public.fixtures where league_id = (select id from target_league))

  union all select 9, 'fixtures belong to 2027',
    ((select count(*) from public.fixtures where league_id = (select id from target_league)
      and extract(year from scheduled_start at time zone 'UTC') = 2027) = 74),
    (select count(*)::text from public.fixtures where league_id = (select id from target_league)
      and extract(year from scheduled_start at time zone 'UTC') = 2027)

  union all select 10, '251 squad players imported separately',
    ((select count(*) from public.league_players where league_id = (select id from target_league)) = 251),
    (select count(*)::text from public.league_players where league_id = (select id from target_league))

  union all select 11, 'no ownership copied',
    ((select count(*) from public.league_players where league_id = (select id from target_league) and owner_member_id is not null) = 0),
    (select count(*)::text from public.league_players where league_id = (select id from target_league) and owner_member_id is not null)

  union all select 12, 'no bids copied',
    ((select count(*) from public.league_players where league_id = (select id from target_league) and bid_price is not null) = 0),
    (select count(*)::text from public.league_players where league_id = (select id from target_league) and bid_price is not null)

  union all select 13, 'no lineups copied',
    ((select count(*) from public.lineup_submissions where league_id = (select id from target_league)) = 0),
    (select count(*)::text from public.lineup_submissions where league_id = (select id from target_league))

  union all select 14, 'no transfers copied',
    ((select count(*) from public.transfer_events where league_id = (select id from target_league)) = 0),
    (select count(*)::text from public.transfer_events where league_id = (select id from target_league))

  union all select 15, 'no player points copied',
    ((select count(*) from public.player_match_points p join public.fixtures f on f.id = p.fixture_id
      where f.league_id = (select id from target_league)) = 0),
    (select count(*)::text from public.player_match_points p join public.fixtures f on f.id = p.fixture_id
      where f.league_id = (select id from target_league))

  union all select 16, 'no owner scores copied',
    ((select count(*) from public.member_match_scores s join public.fixtures f on f.id = s.fixture_id
      where f.league_id = (select id from target_league)) = 0),
    (select count(*)::text from public.member_match_scores s join public.fixtures f on f.id = s.fixture_id
      where f.league_id = (select id from target_league))
)
select test_name, case when coalesce(passed, false) then 'PASS' else 'FAIL' end status, detail
from checks order by n;
