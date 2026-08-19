-- Add the missing unassisted/direct bowler-wicket bonus to every scoring
-- version. Published score rows remain immutable; future compilation and
-- publication use the fixture-effective rule document containing this value.

update public.scoring_rule_sets
set rules = jsonb_set(rules, '{bowling,direct_wicket_bonus}', '10'::jsonb, true)
where not (coalesce(rules->'bowling', '{}'::jsonb) ? 'direct_wicket_bonus');
