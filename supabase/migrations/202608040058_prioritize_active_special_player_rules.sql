-- A newly published active rule supersedes older scheduled rule branches from
-- its own effective match onward. Older inactive versions remain available
-- only for matches before the active version becomes effective.
begin;

create or replace function public.special_player_rules_for_match(
  p_league_id uuid,
  p_match_number integer
)
returns public.special_player_rule_sets
language sql
stable
security invoker
set search_path = public
as $$
  select rules
  from public.special_player_rule_sets rules
  where rules.league_id = p_league_id
    and rules.effective_from_match_number <= p_match_number
  order by
    rules.active desc,
    rules.effective_from_match_number desc,
    rules.version desc
  limit 1
$$;

revoke all on function public.special_player_rules_for_match(uuid, integer)
  from public, anon;
grant execute on function public.special_player_rules_for_match(uuid, integer)
  to authenticated;

commit;
