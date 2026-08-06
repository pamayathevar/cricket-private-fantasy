-- Read-only verification for migration 032.
select
  to_regclass('public.special_player_rule_sets') is not null as rule_table_installed,
  to_regprocedure('public.publish_special_player_rules(uuid,integer,jsonb)') is not null as publishing_rpc_installed,
  to_regprocedure('public.special_player_rules_for_match(uuid,integer)') is not null as resolver_installed,
  has_table_privilege('authenticated', 'public.special_player_rule_sets', 'SELECT') as authenticated_can_read,
  not has_table_privilege('authenticated', 'public.special_player_rule_sets', 'INSERT,UPDATE,DELETE') as direct_writes_blocked,
  has_function_privilege('authenticated', 'public.publish_special_player_rules(uuid,integer,jsonb)', 'EXECUTE') as authenticated_can_publish_via_rpc,
  not has_function_privilege('anon', 'public.publish_special_player_rules(uuid,integer,jsonb)', 'EXECUTE') as anonymous_cannot_publish;

select league.name, rules.version, rules.effective_from_match_number,
  rules.unique_players_per_owner, rules.other_player_fee_percent,
  rules.other_player_minimum_fee, rules.marquee_players_per_owner,
  rules.regular_royalty_percent, rules.marquee_royalty_percent,
  rules.royalty_zero_floor, rules.royalty_rounding,
  rules.automatic_unique_usage_threshold,
  rules.phase_change_deadline_hours, rules.mid_phase_replacement_allowed
from public.special_player_rule_sets rules
join public.leagues league on league.id = rules.league_id
where rules.active
order by league.name;
