-- Configurable minimum royalty for regular and Marquee player usage.
begin;

alter table public.special_player_rule_sets
  add column if not exists regular_minimum_royalty numeric(10,2) not null default 5 check (regular_minimum_royalty >= 0),
  add column if not exists marquee_minimum_royalty numeric(10,2) not null default 15 check (marquee_minimum_royalty >= 0);

create or replace function public.publish_special_player_rules_v2(
  p_league_id uuid,
  p_effective_from_match_number integer,
  p_rules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_rule_id uuid;
  v_regular_minimum numeric := coalesce((p_rules->>'regular_minimum_royalty')::numeric, 5);
  v_marquee_minimum numeric := coalesce((p_rules->>'marquee_minimum_royalty')::numeric, 15);
begin
  if v_regular_minimum < 0 or v_marquee_minimum < 0 then raise exception 'Minimum royalty cannot be negative'; end if;
  v_result := public.publish_special_player_rules(p_league_id, p_effective_from_match_number, p_rules);
  v_rule_id := (v_result->>'id')::uuid;
  update public.special_player_rule_sets
  set regular_minimum_royalty = v_regular_minimum,
      marquee_minimum_royalty = v_marquee_minimum
  where id = v_rule_id;
  update public.audit_events
  set after_data = after_data || jsonb_build_object(
    'regular_minimum_royalty', v_regular_minimum,
    'marquee_minimum_royalty', v_marquee_minimum
  )
  where entity_type = 'special_player_rule_set' and entity_id = v_rule_id::text
    and action = 'special_player_rules_published';
  return v_result || jsonb_build_object(
    'regular_minimum_royalty', v_regular_minimum,
    'marquee_minimum_royalty', v_marquee_minimum
  );
end;
$$;

create or replace function public.special_royalty_points(
  p_final_contribution numeric, p_percent numeric, p_minimum numeric,
  p_zero_floor boolean, p_rounding text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case p_rounding
    when 'immediate_whole_point' then round(greatest(p_final_contribution * p_percent / 100, p_minimum, 0))
    else greatest(p_final_contribution * p_percent / 100, p_minimum, 0)
  end
$$;

-- Upgrade the already-installed publication function to pass the configured minimum.
do $$
declare
  v_definition text;
  v_old_call text := $old$public.special_royalty_points(
        value.player_contribution * value.match_multiplier,
        case when value.is_marquee then v_special.marquee_royalty_percent else v_special.regular_royalty_percent end,
        v_special.royalty_zero_floor, v_special.royalty_rounding
      )$old$;
  v_new_call text := $new$public.special_royalty_points(
        value.player_contribution * value.match_multiplier,
        case when value.is_marquee then v_special.marquee_royalty_percent else v_special.regular_royalty_percent end,
        case when value.is_marquee then v_special.marquee_minimum_royalty else v_special.regular_minimum_royalty end,
        v_special.royalty_zero_floor, v_special.royalty_rounding
      )$new$;
begin
  v_definition := pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure);
  if position(v_old_call in v_definition) = 0 then
    raise exception 'Could not locate the royalty calculation in publish_match_scores; migration 034 must be installed first';
  end if;
  execute replace(v_definition, v_old_call, v_new_call);
end;
$$;

revoke all on function public.publish_special_player_rules_v2(uuid,integer,jsonb) from public;
grant execute on function public.publish_special_player_rules_v2(uuid,integer,jsonb) to authenticated;
revoke all on function public.special_royalty_points(numeric,numeric,numeric,boolean,text) from public;
grant execute on function public.special_royalty_points(numeric,numeric,numeric,boolean,text) to authenticated;

commit;
