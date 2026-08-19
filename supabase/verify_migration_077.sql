select
  count(*) as scoring_rule_versions,
  count(*) filter (
    where rules #>> '{fielding,shared_run_out}' = '10'
  ) as versions_with_shared_run_out_10,
  count(*) filter (
    where rules #>> '{fielding,shared_run_out}' is distinct from '10'
  ) as versions_not_shared_run_out_10
from public.scoring_rule_sets;
