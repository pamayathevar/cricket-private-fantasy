-- Include current Unique/Marquee/Royalty configuration in template snapshots and clones.
begin;

create or replace function public.enrich_template_special_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rules jsonb;
begin
  select to_jsonb(rule_set) - 'id' - 'league_id' - 'version' - 'active' - 'created_by' - 'created_at'
  into rules
  from public.special_player_rule_sets rule_set
  where rule_set.league_id = new.source_league_id and rule_set.active
  order by rule_set.version desc
  limit 1;
  if rules is not null then
    new.configuration := jsonb_set(new.configuration, '{special_player_rules}', rules, true);
  end if;
  return new;
end;
$$;

drop trigger if exists league_templates_enrich_special_rules on public.league_templates;
create trigger league_templates_enrich_special_rules
before insert or update of configuration, source_league_id on public.league_templates
for each row execute function public.enrich_template_special_rules();

-- Upgrade existing active snapshots immediately.
with snapshots as (
  select template.id,
    (select to_jsonb(rule_set) - 'id' - 'league_id' - 'version' - 'active' - 'created_by' - 'created_at'
     from public.special_player_rule_sets rule_set
     where rule_set.league_id = template.source_league_id and rule_set.active
     order by rule_set.version desc limit 1) as snapshot
  from public.league_templates template
  where template.active
)
update public.league_templates template
set configuration = jsonb_set(template.configuration, '{special_player_rules}', rules.snapshot, true),
    updated_at = now()
from snapshots rules
where template.id = rules.id and rules.snapshot is not null
  and template.configuration->'special_player_rules' is distinct from rules.snapshot;

create or replace function public.apply_template_special_rules_after_clone()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  template_id uuid;
  rules jsonb;
begin
  if new.action <> 'league_created_from_template' then return new; end if;
  template_id := nullif(new.after_data->>'template_id', '')::uuid;
  select template.configuration->'special_player_rules' into rules
  from public.league_templates template where template.id = template_id;
  if rules is null or jsonb_typeof(rules) <> 'object' then return new; end if;

  update public.special_player_rule_sets rule_set
  set effective_from_match_number = 1,
      unique_mode_enabled = coalesce((rules->>'unique_mode_enabled')::boolean, false),
      unique_players_per_owner = coalesce((rules->>'unique_players_per_owner')::integer, 2),
      other_player_fee_percent = coalesce((rules->>'other_player_fee_percent')::numeric, 30),
      other_player_minimum_fee = coalesce((rules->>'other_player_minimum_fee')::numeric, 15),
      unique_restrict_captain = coalesce((rules->>'unique_restrict_captain')::boolean, true),
      unique_restrict_vice_captain = coalesce((rules->>'unique_restrict_vice_captain')::boolean, true),
      unique_restrict_impact = coalesce((rules->>'unique_restrict_impact')::boolean, true),
      unique_restrict_3x = coalesce((rules->>'unique_restrict_3x')::boolean, true),
      marquee_mode_enabled = coalesce((rules->>'marquee_mode_enabled')::boolean, false),
      marquee_players_per_owner = coalesce((rules->>'marquee_players_per_owner')::integer, 2),
      regular_royalty_percent = coalesce((rules->>'regular_royalty_percent')::numeric, 5),
      regular_minimum_royalty = coalesce((rules->>'regular_minimum_royalty')::numeric, 5),
      marquee_royalty_percent = coalesce((rules->>'marquee_royalty_percent')::numeric, 15),
      marquee_minimum_royalty = coalesce((rules->>'marquee_minimum_royalty')::numeric, 15),
      royalty_zero_floor = coalesce((rules->>'royalty_zero_floor')::boolean, true),
      royalty_rounding = coalesce(rules->>'royalty_rounding', 'immediate_whole_point'),
      automatic_unique_enabled = coalesce((rules->>'automatic_unique_enabled')::boolean, true),
      automatic_unique_usage_threshold = coalesce((rules->>'automatic_unique_usage_threshold')::integer, 48),
      phase_change_deadline_hours = coalesce((rules->>'phase_change_deadline_hours')::integer, 24),
      mid_phase_replacement_allowed = coalesce((rules->>'mid_phase_replacement_allowed')::boolean, false)
  where rule_set.league_id = new.league_id and rule_set.active;
  return new;
end;
$$;

drop trigger if exists audit_apply_template_special_rules on public.audit_events;
create trigger audit_apply_template_special_rules
after insert on public.audit_events
for each row execute function public.apply_template_special_rules_after_clone();

commit;
