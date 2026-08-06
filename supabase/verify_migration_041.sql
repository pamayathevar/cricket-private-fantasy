select
  exists (select 1 from pg_trigger where tgname = 'league_templates_enrich_special_rules' and not tgisinternal)
    as snapshot_trigger_installed,
  exists (select 1 from pg_trigger where tgname = 'audit_apply_template_special_rules' and not tgisinternal)
    as clone_trigger_installed;

select template.name, template.version,
  jsonb_typeof(template.configuration->'special_player_rules') = 'object' as special_rules_snapshotted,
  template.configuration#>>'{special_player_rules,unique_mode_enabled}' as unique_mode,
  template.configuration#>>'{special_player_rules,marquee_mode_enabled}' as marquee_mode
from public.league_templates template
where template.active
order by template.name, template.version;
