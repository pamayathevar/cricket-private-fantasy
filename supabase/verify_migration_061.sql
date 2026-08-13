-- Expected: the first query returns all true.
with definitions as (
  select
    pg_get_functiondef(
      'public.initialize_special_player_rules_from_format()'::regprocedure
    ) initialize_body,
    pg_get_functiondef(
      'public.publish_special_player_rules(uuid,integer,jsonb)'::regprocedure
    ) publish_body,
    pg_get_functiondef(
      'public.apply_template_special_rules_after_clone()'::regprocedure
    ) clone_body
)
select
  (
    select column_default = '56'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'special_player_rule_sets'
      and column_name = 'automatic_unique_usage_threshold'
  ) as column_default_is_56,
  position('automatic_unique_usage_threshold' in initialize_body) > 0
    and position(', 56)' in initialize_body) > 0
    as initializer_default_is_56,
  position('automatic_unique_usage_threshold' in publish_body) > 0
    and position(', 56)' in publish_body) > 0
    as publisher_default_is_56,
  position('automatic_unique_usage_threshold' in clone_body) > 0
    and clone_body ~ 'automatic_unique_usage_threshold''\)::integer,[[:space:]]*56'
    as template_clone_default_is_56
from definitions;

-- Expected: no rows. Active rules that used the previous default must be
-- versioned to 56; deliberately customized thresholds are preserved.
select
  league.name league_name,
  rule_set.version,
  rule_set.effective_from_match_number,
  rule_set.automatic_unique_usage_threshold,
  rule_set.active
from public.special_player_rule_sets rule_set
join public.leagues league on league.id = rule_set.league_id
where rule_set.active
  and rule_set.automatic_unique_usage_threshold = 48
order by league.name;

-- Expected: no rows. A fixture-effective label may appear only after the
-- qualifying borrowed-use count exceeds that fixture's configured threshold.
select
  fixture.match_number,
  label.player_id,
  label.full_name,
  public.automatic_unique_qualifying_usage_count(
    fixture.id,
    label.player_id
  ) qualifying_usage,
  rules.automatic_unique_usage_threshold threshold
from public.fixtures fixture
cross join lateral public.special_player_rules_for_match(
  fixture.league_id,
  fixture.match_number
) rules
cross join lateral public.special_player_labels_for_fixture(fixture.id) label
where label.label = 'AUTO UNIQUE'
  and public.automatic_unique_qualifying_usage_count(
        fixture.id,
        label.player_id
      ) <= rules.automatic_unique_usage_threshold;
