-- Expected: all definition checks are true and the mismatch query returns no rows.
with definition as (
  select pg_get_functiondef(
    'public.special_player_rules_for_match(uuid,integer)'::regprocedure
  ) body
)
select
  position($needle$rules.active desc$needle$ in lower(body)) > 0
    as active_rule_is_prioritized,
  position($needle$rules.effective_from_match_number desc$needle$ in lower(body)) > 0
    as historical_fallback_uses_effective_match,
  has_function_privilege(
    'authenticated',
    'public.special_player_rules_for_match(uuid,integer)',
    'EXECUTE'
  ) as authenticated_can_resolve_rules,
  not has_function_privilege(
    'anon',
    'public.special_player_rules_for_match(uuid,integer)',
    'EXECUTE'
  ) as anonymous_cannot_resolve_rules
from definition;

with active_rules as (
  select rules.*
  from public.special_player_rule_sets rules
  where rules.active
), applicable_fixtures as (
  select
    fixture.id as fixture_id,
    fixture.match_number,
    active_rule.id as expected_rule_id,
    resolved.id as resolved_rule_id
  from public.fixtures fixture
  join active_rules active_rule
    on active_rule.league_id = fixture.league_id
   and fixture.match_number >= active_rule.effective_from_match_number
  cross join lateral public.special_player_rules_for_match(
    fixture.league_id,
    fixture.match_number
  ) resolved
)
select fixture_id, match_number, expected_rule_id, resolved_rule_id
from applicable_fixtures
where resolved_rule_id is distinct from expected_rule_id
order by match_number;
