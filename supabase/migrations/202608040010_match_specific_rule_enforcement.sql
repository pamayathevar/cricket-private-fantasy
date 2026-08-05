-- Resolve and enforce Playing/Points rule versions by fixture match number.
begin;

create or replace function public.lineup_rule_set_for_fixture(p_fixture_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select rules.id
  from public.fixtures fixture
  join public.lineup_rule_sets rules
    on rules.league_id = fixture.league_id
   and rules.effective_from_match_number <= fixture.match_number
  where fixture.id = p_fixture_id
  order by rules.effective_from_match_number desc, rules.version desc
  limit 1
$$;

create or replace function public.scoring_rule_set_for_fixture(p_fixture_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select rules.id
  from public.fixtures fixture
  join public.scoring_rule_sets rules
    on rules.league_id = fixture.league_id
   and rules.effective_from_match_number <= fixture.match_number
  where fixture.id = p_fixture_id
  order by rules.effective_from_match_number desc, rules.version desc
  limit 1
$$;

-- Preserve the established submission implementation and replace only its
-- active-rule lookup with the fixture-effective lookup. This keeps all existing
-- validation, locking, RLS, lineup writes and audit behavior intact.
do $$
declare
  v_signature regprocedure := 'public.submit_lineup(uuid,uuid[],uuid,uuid,uuid,text)'::regprocedure;
  v_definition text;
  v_old_lookup text := 'select * into v_rules from public.lineup_rule_sets where league_id = v_fixture.league_id and active;';
  v_new_lookup text := 'select * into v_rules from public.lineup_rule_sets where id = public.lineup_rule_set_for_fixture(v_fixture.id);';
begin
  select pg_get_functiondef(v_signature) into v_definition;
  if position(v_old_lookup in v_definition) = 0 then
    raise exception 'submit_lineup rule lookup was not recognized; migration stopped without changing it';
  end if;
  execute replace(v_definition, v_old_lookup, v_new_lookup);
end;
$$;

revoke all on function public.lineup_rule_set_for_fixture(uuid) from public;
revoke all on function public.scoring_rule_set_for_fixture(uuid) from public;
grant execute on function public.lineup_rule_set_for_fixture(uuid) to authenticated;
grant execute on function public.scoring_rule_set_for_fixture(uuid) to authenticated;

commit;
