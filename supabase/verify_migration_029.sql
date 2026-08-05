select
  to_regprocedure('public.publish_match_scores(uuid)') is not null as score_publish_rpc_installed,
  position('v_ownership_deductions_enabled' in pg_get_functiondef(
    'public.publish_match_scores(uuid)'::regprocedure
  )) > 0 as format_deduction_switch_installed,
  position('acquisition_mode' in pg_get_functiondef(
    'public.publish_match_scores(uuid)'::regprocedure
  )) > 0 as format_audit_installed;

select
  league.name,
  format.acquisition_mode,
  format.ownership_enabled,
  format.other_owner_deductions_enabled,
  case
    when format.acquisition_mode = 'all_open'
      and not format.ownership_enabled
      and not format.other_owner_deductions_enabled then 'PASS'
    when format.acquisition_mode = 'auction'
      and format.ownership_enabled then 'PASS'
    else 'CHECK'
  end as format_consistency
from public.league_format_configs format
join public.leagues league on league.id = format.league_id
order by league.season_year, league.name;

-- Published historical scores are intentionally not recalculated by this migration.
select
  league.name,
  count(distinct fixture.id) filter (where fixture.scoring_status in ('published', 'corrected')) as published_matches,
  count(score.id) as existing_member_scores
from public.leagues league
left join public.fixtures fixture on fixture.league_id = league.id
left join public.member_match_scores score on score.fixture_id = fixture.id
group by league.id, league.name
order by league.name;
