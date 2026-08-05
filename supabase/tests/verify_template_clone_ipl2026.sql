-- Read-only end-to-end verification for the first clean template-clone test.
-- Source slug: ipl-2026
-- Target slug: template-test-2026
-- Create the target with "Copy owner emails" OFF before running this query.
with
source_league as (
  select id from public.leagues where slug = 'ipl-2026'
),
target_league as (
  select id, status from public.leagues where slug = 'template-test-2026'
),
checks as (
  select 1 as sort_order, 'target league exists' as test_name,
    exists(select 1 from target_league) as passed,
    coalesce((select status from target_league), 'missing') as detail

  union all
  select 2, 'target remains setup draft',
    (select status = 'setup' from target_league),
    coalesce((select status from target_league), 'missing')

  union all
  select 3, 'format configuration copied',
    (select (to_jsonb(target) - 'league_id' - 'created_by' - 'created_at' - 'updated_at' - 'locked_at' - 'setup_status')
          = (to_jsonb(source) - 'league_id' - 'created_by' - 'created_at' - 'updated_at' - 'locked_at' - 'setup_status')
     from public.league_format_configs source
     cross join public.league_format_configs target
     where source.league_id = (select id from source_league)
       and target.league_id = (select id from target_league)),
    'acquisition, ownership, bidding, marquee, unique and royalty settings'

  union all
  select 4, 'playing rules copied',
    (select (to_jsonb(target) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'version' - 'name' - 'effective_from_match_number')
          = (to_jsonb(source) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'version' - 'name' - 'effective_from_match_number')
     from public.lineup_rule_sets source
     cross join public.lineup_rule_sets target
     where source.league_id = (select id from source_league) and source.active
       and target.league_id = (select id from target_league) and target.active),
    'active playing-rule values'

  union all
  select 5, 'points rules copied',
    (select target.rules = source.rules
     from public.scoring_rule_sets source
     cross join public.scoring_rule_sets target
     where source.league_id = (select id from source_league) and source.active
       and target.league_id = (select id from target_league) and target.active),
    'active scoring JSON'

  union all
  select 6, 'phases copied',
    (select coalesce(jsonb_agg(to_jsonb(target) - 'id' - 'league_id' - 'created_at' - 'updated_at' order by target.sort_order), '[]'::jsonb)
          = (select coalesce(jsonb_agg(to_jsonb(source) - 'id' - 'league_id' - 'created_at' - 'updated_at' order by source.sort_order), '[]'::jsonb)
             from public.league_phases source where source.league_id = (select id from source_league) and source.active)
     from public.league_phases target where target.league_id = (select id from target_league) and target.active),
    'phase count and values'

  union all
  select 7, 'transfer periods copied',
    (select coalesce(jsonb_agg(to_jsonb(target) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'updated_at' order by target.sort_order), '[]'::jsonb)
          = (select coalesce(jsonb_agg(to_jsonb(source) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'updated_at' order by source.sort_order), '[]'::jsonb)
             from public.league_transfer_periods source where source.league_id = (select id from source_league) and source.active)
     from public.league_transfer_periods target where target.league_id = (select id from target_league) and target.active),
    'transfer-period count and values'

  union all
  select 8, 'boosters copied',
    (select coalesce(jsonb_agg(to_jsonb(target) - 'id' - 'league_id' - 'created_at' - 'updated_at' order by target.code), '[]'::jsonb)
          = (select coalesce(jsonb_agg(to_jsonb(source) - 'id' - 'league_id' - 'created_at' - 'updated_at' order by source.code), '[]'::jsonb)
             from public.booster_rules source where source.league_id = (select id from source_league) and source.active)
     from public.booster_rules target where target.league_id = (select id from target_league) and target.active),
    'booster count and values'

  union all
  select 9, 'only creator membership exists',
    (select count(*) = 1 from public.league_members where league_id = (select id from target_league)),
    (select count(*)::text from public.league_members where league_id = (select id from target_league))

  union all
  select 10, 'no auction ownership copied',
    (select count(*) = 0 from public.league_players where league_id = (select id from target_league)),
    (select count(*)::text from public.league_players where league_id = (select id from target_league))

  union all
  select 11, 'no fixtures copied',
    (select count(*) = 0 from public.fixtures where league_id = (select id from target_league)),
    (select count(*)::text from public.fixtures where league_id = (select id from target_league))

  union all
  select 12, 'no lineups copied',
    (select count(*) = 0 from public.lineup_submissions where league_id = (select id from target_league)),
    (select count(*)::text from public.lineup_submissions where league_id = (select id from target_league))

  union all
  select 13, 'no transfers copied',
    (select count(*) = 0 from public.transfer_events where league_id = (select id from target_league)),
    (select count(*)::text from public.transfer_events where league_id = (select id from target_league))

  union all
  select 14, 'no player points copied',
    (select count(*) = 0 from public.player_match_points points
      join public.fixtures fixture on fixture.id = points.fixture_id
      where fixture.league_id = (select id from target_league)),
    (select count(*)::text from public.player_match_points points
      join public.fixtures fixture on fixture.id = points.fixture_id
      where fixture.league_id = (select id from target_league))

  union all
  select 15, 'no member scores copied',
    (select count(*) = 0 from public.member_match_scores score
      join public.fixtures fixture on fixture.id = score.fixture_id
      where fixture.league_id = (select id from target_league)),
    (select count(*)::text from public.member_match_scores score
      join public.fixtures fixture on fixture.id = score.fixture_id
      where fixture.league_id = (select id from target_league))
)
select test_name, case when coalesce(passed, false) then 'PASS' else 'FAIL' end as status, detail
from checks
order by sort_order;
