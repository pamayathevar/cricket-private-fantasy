select
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'special_player_rule_sets' and column_name = 'regular_minimum_royalty') as regular_minimum_installed,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'special_player_rule_sets' and column_name = 'marquee_minimum_royalty') as marquee_minimum_installed,
  to_regprocedure('public.publish_special_player_rules_v2(uuid,integer,jsonb)') is not null as publishing_v2_installed,
  public.special_royalty_points(100, 5, 5, true, 'immediate_whole_point') = 5 as normal_100_is_5,
  public.special_royalty_points(0, 5, 5, true, 'immediate_whole_point') = 5 as normal_zero_is_5,
  public.special_royalty_points(-100, 15, 15, true, 'immediate_whole_point') = 15 as marquee_negative_is_15,
  position('marquee_minimum_royalty' in pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure)) > 0 as publication_uses_minimums,
  not has_function_privilege('anon', 'public.publish_special_player_rules_v2(uuid,integer,jsonb)', 'EXECUTE') as anonymous_cannot_publish;

select league.name, rules.version, rules.regular_royalty_percent, rules.regular_minimum_royalty,
  rules.marquee_royalty_percent, rules.marquee_minimum_royalty
from public.special_player_rule_sets rules
join public.leagues league on league.id = rules.league_id
where rules.active
order by league.name;
