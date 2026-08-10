-- Expected: all values are true.
with safe_definition as (
  select pg_get_functiondef('public.publish_match_scores_safe(uuid)'::regprocedure) body
)
select
  position('for update' in body) > 0
    and position('for update' in body) < position('select max(calculation_version)' in body)
    as completeness_check_is_serialized_with_score_staging,
  not has_function_privilege(
    'authenticated', 'public.publish_match_scores(uuid)', 'EXECUTE'
  ) as authenticated_cannot_bypass_safe_publication,
  has_function_privilege(
    'authenticated', 'public.publish_match_scores_safe(uuid)', 'EXECUTE'
  ) as authenticated_can_use_safe_publication,
  not has_function_privilege(
    'anon', 'public.publish_match_scores(uuid)', 'EXECUTE'
  ) as anonymous_cannot_publish_raw_scores,
  not has_function_privilege(
    'anon', 'public.publish_match_scores_safe(uuid)', 'EXECUTE'
  ) as anonymous_cannot_publish_scores,
  not has_function_privilege(
    'authenticated', 'public.publish_league_rules(uuid,jsonb,jsonb)', 'EXECUTE'
  ) as authenticated_cannot_bypass_effective_rule_publishing,
  has_function_privilege(
    'authenticated', 'public.publish_league_rules_effective(uuid,jsonb,jsonb,integer,integer)', 'EXECUTE'
  ) as authenticated_can_publish_effective_rules,
  not has_function_privilege(
    'authenticated', 'public.publish_special_player_rules(uuid,integer,jsonb)', 'EXECUTE'
  ) as authenticated_cannot_bypass_minimum_royalty_rules,
  has_function_privilege(
    'authenticated', 'public.publish_special_player_rules_v2(uuid,integer,jsonb)', 'EXECUTE'
  ) as authenticated_can_publish_current_special_rules,
  not has_function_privilege(
    'authenticated', 'public.update_league_transfer_limits(uuid,integer,integer)', 'EXECUTE'
  ) as authenticated_cannot_edit_obsolete_transfer_buckets
from safe_definition;
