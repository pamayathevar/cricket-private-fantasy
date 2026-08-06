-- Persist the configured minimum on royalty adjustment rows for a complete audit trail.
begin;

update public.special_player_score_adjustments adjustment
set minimum_fee = case
  when adjustment.adjustment_type = 'marquee_royalty' then rules.marquee_minimum_royalty
  when adjustment.adjustment_type = 'regular_royalty' then rules.regular_minimum_royalty
  else adjustment.minimum_fee
end
from public.special_player_rule_sets rules
where rules.id = adjustment.rule_set_id
  and adjustment.adjustment_type in ('regular_royalty', 'marquee_royalty')
  and adjustment.minimum_fee is null;

do $$
declare
  v_definition text;
  v_old_fragment text := $old$case when value.is_marquee then v_special.marquee_royalty_percent else v_special.regular_royalty_percent end,
      null,
      public.special_royalty_points($old$;
  v_new_fragment text := $new$case when value.is_marquee then v_special.marquee_royalty_percent else v_special.regular_royalty_percent end,
      case when value.is_marquee then v_special.marquee_minimum_royalty else v_special.regular_minimum_royalty end,
      public.special_royalty_points($new$;
begin
  v_definition := pg_get_functiondef('public.publish_match_scores(uuid)'::regprocedure);
  if position(v_old_fragment in v_definition) = 0 then
    raise exception 'Could not locate the royalty adjustment insert in publish_match_scores';
  end if;
  execute replace(v_definition, v_old_fragment, v_new_fragment);
end;
$$;

commit;
