-- Every active saved template must start transfers at Match 1 and contain no gaps.
with periods as (
  select template.id, template.name, template.version,
    coalesce((period.value->>'sort_order')::integer, period.ordinality::integer) as sort_order,
    (period.value->>'start_match_number')::integer as start_match_number,
    (period.value->>'end_match_number')::integer as end_match_number
  from public.league_templates template
  cross join lateral jsonb_array_elements(coalesce(template.configuration->'transfer_periods', '[]'::jsonb))
    with ordinality period(value, ordinality)
  where template.active
), checked as (
  select *, lag(end_match_number) over (partition by id order by sort_order) as previous_end
  from periods
)
select name, version, start_match_number, end_match_number,
  case
    when sort_order = min(sort_order) over (partition by id) and start_match_number <> 1 then 'FAIL: first period must start at Match 1'
    when previous_end is not null and start_match_number <> previous_end + 1 then 'FAIL: transfer-period gap'
    else 'PASS'
  end as status
from checked
order by name, version, sort_order;

select not exists (
  with periods as (
    select template.id,
      coalesce((period.value->>'sort_order')::integer, period.ordinality::integer) as sort_order,
      (period.value->>'start_match_number')::integer as start_match_number,
      (period.value->>'end_match_number')::integer as end_match_number
    from public.league_templates template
    cross join lateral jsonb_array_elements(coalesce(template.configuration->'transfer_periods', '[]'::jsonb))
      with ordinality period(value, ordinality)
    where template.active
  ), checked as (
    select *, lag(end_match_number) over (partition by id order by sort_order) as previous_end,
      min(sort_order) over (partition by id) as first_sort_order
    from periods
  )
  select 1 from checked
  where (sort_order = first_sort_order and start_match_number <> 1)
     or (previous_end is not null and start_match_number <> previous_end + 1)
) as all_active_templates_gap_free;
