-- Raise the Automatic Unique default to 56 qualifying borrowed appearances.
-- Existing leagues still using the prior default receive a new version effective
-- from their next unlocked fixture. Deliberately customized thresholds and the
-- rule sets pinned to locked/published matches are retained.
begin;

lock table public.special_player_rule_sets in share row exclusive mode;

alter table public.special_player_rule_sets
  alter column automatic_unique_usage_threshold set default 56;

do $$
declare
  v_definition text;
  v_rewritten text;
begin
  v_definition := pg_get_functiondef('public.initialize_special_player_rules_from_format()'::regprocedure);
  if position('automatic_unique_usage_threshold' in v_definition) > 0
     and position(', 48' in v_definition) > 0 then
    execute replace(v_definition, ', 48', ', 56');
  elsif position(', 56' in v_definition) = 0 then
    raise exception 'Could not locate the Automatic Unique default in initialize_special_player_rules_from_format';
  end if;

  v_definition := pg_get_functiondef('public.publish_special_player_rules(uuid,integer,jsonb)'::regprocedure);
  if position('automatic_unique_usage_threshold' in v_definition) > 0
     and position(', 48' in v_definition) > 0 then
    execute replace(v_definition, ', 48', ', 56');
  elsif position(', 56' in v_definition) = 0 then
    raise exception 'Could not locate the Automatic Unique default in publish_special_player_rules';
  end if;

  v_definition := pg_get_functiondef('public.apply_template_special_rules_after_clone()'::regprocedure);
  v_rewritten := regexp_replace(
    v_definition,
    '(automatic_unique_usage_threshold''\)::integer,[[:space:]]*)48',
    E'\\1' || '56'
  );
  if v_rewritten is distinct from v_definition then
    execute v_rewritten;
  elsif v_definition !~ 'automatic_unique_usage_threshold''\)::integer,[[:space:]]*56' then
    raise exception 'Could not locate the Automatic Unique default in apply_template_special_rules_after_clone';
  end if;
end;
$$;

do $$
declare
  v_rule public.special_player_rule_sets%rowtype;
  v_effective_match integer;
  v_version integer;
begin
  for v_rule in
    select rule_set.*
    from public.special_player_rule_sets rule_set
    where rule_set.active
      and rule_set.automatic_unique_usage_threshold = 48
    order by rule_set.league_id
  loop
    select coalesce(
      min(fixture.match_number) filter (
        where fixture.status = 'scheduled'
          and now() < fixture.lineup_lock_at
      ),
      max(fixture.match_number) + 1,
      1
    )
    into v_effective_match
    from public.fixtures fixture
    where fixture.league_id = v_rule.league_id;

    select coalesce(max(rule_set.version), 0) + 1
    into v_version
    from public.special_player_rule_sets rule_set
    where rule_set.league_id = v_rule.league_id;

    update public.special_player_rule_sets
    set active = false
    where id = v_rule.id;

    insert into public.special_player_rule_sets (
      league_id,
      version,
      effective_from_match_number,
      unique_mode_enabled,
      unique_players_per_owner,
      other_player_fee_percent,
      other_player_minimum_fee,
      unique_restrict_captain,
      unique_restrict_vice_captain,
      unique_restrict_impact,
      unique_restrict_3x,
      marquee_mode_enabled,
      marquee_players_per_owner,
      regular_royalty_percent,
      marquee_royalty_percent,
      royalty_zero_floor,
      royalty_rounding,
      automatic_unique_enabled,
      automatic_unique_usage_threshold,
      phase_change_deadline_hours,
      mid_phase_replacement_allowed,
      active,
      created_by,
      regular_minimum_royalty,
      marquee_minimum_royalty
    ) values (
      v_rule.league_id,
      v_version,
      greatest(v_effective_match, v_rule.effective_from_match_number),
      v_rule.unique_mode_enabled,
      v_rule.unique_players_per_owner,
      v_rule.other_player_fee_percent,
      v_rule.other_player_minimum_fee,
      v_rule.unique_restrict_captain,
      v_rule.unique_restrict_vice_captain,
      v_rule.unique_restrict_impact,
      v_rule.unique_restrict_3x,
      v_rule.marquee_mode_enabled,
      v_rule.marquee_players_per_owner,
      v_rule.regular_royalty_percent,
      v_rule.marquee_royalty_percent,
      v_rule.royalty_zero_floor,
      v_rule.royalty_rounding,
      v_rule.automatic_unique_enabled,
      56,
      v_rule.phase_change_deadline_hours,
      v_rule.mid_phase_replacement_allowed,
      true,
      v_rule.created_by,
      v_rule.regular_minimum_royalty,
      v_rule.marquee_minimum_royalty
    );
  end loop;
end;
$$;

update public.league_format_configs config
set royalty_config = coalesce(config.royalty_config, '{}'::jsonb)
  || jsonb_build_object('automatic_unique_usage_threshold', 56)
where exists (
  select 1
  from public.special_player_rule_sets rule_set
  join public.leagues league on league.id = rule_set.league_id
  where rule_set.league_id = config.league_id
    and rule_set.active
    and rule_set.automatic_unique_usage_threshold = 56
    and league.status = 'setup'
);

commit;
