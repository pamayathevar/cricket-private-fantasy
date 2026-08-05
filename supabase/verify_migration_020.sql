-- Read-only verification for the IPL 2025 -> IPL 2027 fixture template.
with target as (
  select id from public.leagues
  where slug = 'ipl-2027'
     or (season_year = 2027 and (lower(name) = 'ipl 2027' or competition ilike '%indian premier league%' or competition ilike '%ipl%'))
), summary as (
  select
    count(*) as fixture_count,
    count(*) filter (where match_number between 1 and 70 and stage = 'league') as league_matches,
    count(*) filter (where match_number between 71 and 73 and stage = 'playoff') as playoff_matches,
    count(*) filter (where match_number = 74 and stage = 'final') as finals,
    count(*) filter (where status <> 'scheduled' or scoring_status <> 'pending') as non_clean_matches,
    min(scheduled_start) as first_start,
    max(scheduled_start) as last_start
  from public.fixtures
  where league_id = (select id from target)
)
select 'IPL 2027 fixture count' as test_name,
       case when fixture_count = 74 then 'PASS' else 'FAIL' end as status,
       fixture_count::text as detail
from summary
union all
select '70 league + 3 playoff + 1 final',
       case when league_matches = 70 and playoff_matches = 3 and finals = 1 then 'PASS' else 'FAIL' end,
       format('%s league, %s playoff, %s final', league_matches, playoff_matches, finals)
from summary
union all
select 'All fixtures clean and scheduled',
       case when non_clean_matches = 0 then 'PASS' else 'FAIL' end,
       format('%s non-clean fixtures', non_clean_matches)
from summary
union all
select 'Shifted 2027 date range',
       case when first_start = '2027-03-22 14:00:00+00'::timestamptz and last_start = '2027-06-03 14:00:00+00'::timestamptz then 'PASS' else 'FAIL' end,
       format('%s to %s', first_start, last_start)
from summary;
