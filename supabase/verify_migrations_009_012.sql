-- Read-only verification of the effective-rule, transfer and revalidation migrations.
select * from (values
  ('009', 'Effective rule matches',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lineup_rule_sets' and column_name = 'effective_from_match_number')
    and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scoring_rule_sets' and column_name = 'effective_from_match_number')),
  ('010', 'Match-specific rule enforcement',
    to_regprocedure('public.lineup_rule_set_for_fixture(uuid)') is not null
    and to_regprocedure('public.scoring_rule_set_for_fixture(uuid)') is not null),
  ('011', 'Transfer enforcement',
    to_regprocedure('public.submit_lineup_with_transfer_enforcement(uuid,uuid[],uuid,uuid,uuid,text,text,uuid)') is not null),
  ('012', 'Future lineup revalidation',
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lineup_submissions' and column_name = 'validation_status')
    and exists (select 1 from pg_trigger where tgname = 'lineup_rules_revalidate_future_lineups' and not tgisinternal))
) checks(migration, feature, installed)
order by migration;
