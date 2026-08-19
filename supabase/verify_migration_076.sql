-- Read-only verification for 20260818140000_direct_wicket_bonus.sql.

select
  count(*) as scoring_rule_versions,
  count(*) filter (
    where rules #>> '{bowling,direct_wicket_bonus}' = '10'
  ) as versions_with_direct_wicket_bonus,
  count(*) filter (
    where not (coalesce(rules->'bowling', '{}'::jsonb) ? 'direct_wicket_bonus')
  ) as versions_missing_direct_wicket_bonus
from public.scoring_rule_sets;
