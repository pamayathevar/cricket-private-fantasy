select
  exists (select 1 from pg_trigger where tgname = 'validate_special_player_rule_mode_before_write' and not tgisinternal)
    as ownership_guard_installed,
  not exists (
    select 1 from public.special_player_rule_sets rules
    join public.league_format_configs format on format.league_id = rules.league_id
    where rules.active and not format.ownership_enabled
      and (rules.unique_mode_enabled or rules.marquee_mode_enabled)
  ) as no_invalid_all_open_mode,
  not exists (
    select 1 from public.special_player_rule_sets
    where active and unique_mode_enabled and marquee_mode_enabled
  ) as no_combined_modes;

select league.name, rules.version, format.acquisition_mode,
  rules.unique_mode_enabled, rules.marquee_mode_enabled, rules.active
from public.special_player_rule_sets rules
join public.leagues league on league.id = rules.league_id
join public.league_format_configs format on format.league_id = rules.league_id
where rules.active
order by league.name;
