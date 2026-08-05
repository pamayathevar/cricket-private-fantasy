-- Schedule playing and points rule versions from a selected fixture number.
begin;

alter table public.lineup_rule_sets
  add column effective_from_match_number integer not null default 1
  check (effective_from_match_number > 0);
alter table public.scoring_rule_sets
  add column effective_from_match_number integer not null default 1
  check (effective_from_match_number > 0);

update public.lineup_rule_sets rules
set effective_from_match_number = coalesce((
  select min(match_number) from public.fixtures
  where league_id = rules.league_id and status = 'scheduled'
), 1)
where rules.version > 1;
update public.scoring_rule_sets rules
set effective_from_match_number = coalesce((
  select min(match_number) from public.fixtures
  where league_id = rules.league_id and status = 'scheduled'
), 1)
where rules.version > 1;

create index lineup_rule_sets_effective_idx
  on public.lineup_rule_sets (league_id, effective_from_match_number, version desc);
create index scoring_rule_sets_effective_idx
  on public.scoring_rule_sets (league_id, effective_from_match_number, version desc);

create or replace function public.publish_league_rules_effective(
  p_league_id uuid,
  p_lineup_rules jsonb,
  p_scoring_rules jsonb,
  p_lineup_effective_from_match integer,
  p_scoring_effective_from_match integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_lineup_version integer;
  v_scoring_version integer;
begin
  if not public.is_league_admin(p_league_id) then raise exception 'League admin access required'; end if;
  if not exists (select 1 from public.fixtures where league_id = p_league_id and match_number = p_lineup_effective_from_match and status = 'scheduled') then
    raise exception 'Playing rules must start from a scheduled match';
  end if;
  if not exists (select 1 from public.fixtures where league_id = p_league_id and match_number = p_scoring_effective_from_match and status = 'scheduled') then
    raise exception 'Points rules must start from a scheduled match';
  end if;

  v_result := public.publish_league_rules(p_league_id, p_lineup_rules, p_scoring_rules);
  v_lineup_version := (v_result ->> 'lineup_version')::integer;
  v_scoring_version := (v_result ->> 'scoring_version')::integer;

  update public.lineup_rule_sets
  set effective_from_match_number = p_lineup_effective_from_match
  where league_id = p_league_id and version = v_lineup_version;
  update public.scoring_rule_sets
  set effective_from_match_number = p_scoring_effective_from_match
  where league_id = p_league_id and version = v_scoring_version;

  update public.audit_events
  set after_data = after_data || jsonb_build_object(
    'lineup_effective_from_match', p_lineup_effective_from_match,
    'scoring_effective_from_match', p_scoring_effective_from_match
  )
  where id = (
    select id from public.audit_events
    where league_id = p_league_id and actor_user_id = auth.uid()
      and action = 'league_rules_published'
    order by created_at desc limit 1
  );

  return v_result || jsonb_build_object(
    'lineup_effective_from_match', p_lineup_effective_from_match,
    'scoring_effective_from_match', p_scoring_effective_from_match
  );
end;
$$;

revoke all on function public.publish_league_rules_effective(uuid, jsonb, jsonb, integer, integer) from public;
grant execute on function public.publish_league_rules_effective(uuid, jsonb, jsonb, integer, integer) to authenticated;

commit;
