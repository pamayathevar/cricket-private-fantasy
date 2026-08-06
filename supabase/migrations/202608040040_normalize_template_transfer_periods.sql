-- Repair legacy template snapshots whose transfer periods omitted each free reset match.
-- Current template saves already copy validated, gap-free periods from the source league.
begin;

with expanded as (
  select template.id as template_id, period.value as period,
    coalesce((period.value->>'sort_order')::integer, period.ordinality::integer) as sort_order,
    (period.value->>'end_match_number')::integer as end_match_number
  from public.league_templates template
  cross join lateral jsonb_array_elements(coalesce(template.configuration->'transfer_periods', '[]'::jsonb))
    with ordinality period(value, ordinality)
  where template.active
), normalized as (
  select template_id, sort_order,
    jsonb_set(
      period,
      '{start_match_number}',
      to_jsonb(coalesce(lag(end_match_number) over (partition by template_id order by sort_order) + 1, 1)),
      true
    ) as period
  from expanded
), rebuilt as (
  select template_id, jsonb_agg(period order by sort_order) as periods
  from normalized
  group by template_id
)
update public.league_templates template
set configuration = jsonb_set(template.configuration, '{transfer_periods}', rebuilt.periods, true),
    updated_at = now()
from rebuilt
where template.id = rebuilt.template_id
  and template.configuration->'transfer_periods' is distinct from rebuilt.periods;

commit;
