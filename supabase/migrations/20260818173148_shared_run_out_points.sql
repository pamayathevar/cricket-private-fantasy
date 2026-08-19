-- Set shared run-out points to 10 for every scoring rule version.
-- Published score rows remain unchanged; regenerated reviews use the updated rules.
update public.scoring_rule_sets
set rules = jsonb_set(rules, '{fielding,shared_run_out}', '10'::jsonb, true)
where rules #>> '{fielding,shared_run_out}' is distinct from '10';
