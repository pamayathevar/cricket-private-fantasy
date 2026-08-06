-- Versioned Unique-player, Marquee, royalty and automatic-Unique configuration.
begin;

create table public.special_player_rule_sets (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  version integer not null check (version > 0),
  effective_from_match_number integer not null check (effective_from_match_number > 0),
  unique_mode_enabled boolean not null default false,
  unique_players_per_owner integer not null default 2 check (unique_players_per_owner between 1 and 10),
  other_player_fee_percent numeric(5,2) not null default 30 check (other_player_fee_percent between 0 and 100),
  other_player_minimum_fee numeric(10,2) not null default 15 check (other_player_minimum_fee >= 0),
  unique_restrict_captain boolean not null default true,
  unique_restrict_vice_captain boolean not null default true,
  unique_restrict_impact boolean not null default true,
  unique_restrict_3x boolean not null default true,
  marquee_mode_enabled boolean not null default false,
  marquee_players_per_owner integer not null default 2 check (marquee_players_per_owner between 1 and 10),
  regular_royalty_percent numeric(5,2) not null default 5 check (regular_royalty_percent between 0 and 100),
  marquee_royalty_percent numeric(5,2) not null default 15 check (marquee_royalty_percent between 0 and 100),
  royalty_zero_floor boolean not null default true,
  royalty_rounding text not null default 'immediate_whole_point'
    check (royalty_rounding in ('immediate_whole_point', 'final_total_whole_point', 'none')),
  automatic_unique_enabled boolean not null default true,
  automatic_unique_usage_threshold integer not null default 48 check (automatic_unique_usage_threshold >= 0),
  phase_change_deadline_hours integer not null default 24 check (phase_change_deadline_hours between 0 and 720),
  mid_phase_replacement_allowed boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (league_id, version),
  unique (league_id, effective_from_match_number, version),
  check (not marquee_mode_enabled or marquee_royalty_percent >= regular_royalty_percent)
);

create unique index special_player_rule_sets_one_active_idx
  on public.special_player_rule_sets (league_id) where active;
create index special_player_rule_sets_effective_idx
  on public.special_player_rule_sets (league_id, effective_from_match_number, version desc);

insert into public.special_player_rule_sets (
  league_id, version, effective_from_match_number,
  unique_mode_enabled, marquee_mode_enabled, automatic_unique_enabled, created_by
)
select config.league_id, 1, 1,
  config.unique_players_enabled,
  config.marquee_enabled or config.royalty_enabled,
  config.royalty_enabled,
  config.created_by
from public.league_format_configs config
on conflict (league_id, version) do nothing;

create or replace function public.initialize_special_player_rules_from_format()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.special_player_rule_sets (
    league_id, version, effective_from_match_number,
    unique_mode_enabled, unique_players_per_owner,
    other_player_fee_percent, other_player_minimum_fee,
    unique_restrict_captain, unique_restrict_vice_captain,
    unique_restrict_impact, unique_restrict_3x,
    marquee_mode_enabled, marquee_players_per_owner,
    regular_royalty_percent, marquee_royalty_percent,
    royalty_zero_floor, royalty_rounding,
    automatic_unique_enabled, automatic_unique_usage_threshold,
    phase_change_deadline_hours, mid_phase_replacement_allowed,
    created_by
  ) values (
    new.league_id, 1, 1,
    new.unique_players_enabled, coalesce((new.unique_config->>'players_per_owner')::integer, 2),
    coalesce((new.unique_config->>'usage_fee_percent')::numeric, 30),
    coalesce((new.unique_config->>'minimum_usage_fee')::numeric, 15),
    coalesce((new.unique_config->>'restrict_captain')::boolean, true),
    coalesce((new.unique_config->>'restrict_vice_captain')::boolean, true),
    coalesce((new.unique_config->>'restrict_impact')::boolean, true),
    coalesce((new.unique_config->>'restrict_3x')::boolean, true),
    new.marquee_enabled or new.royalty_enabled,
    coalesce((new.marquee_config->>'players_per_owner')::integer, 2),
    coalesce((new.royalty_config->>'regular_percent')::numeric, 5),
    coalesce((new.royalty_config->>'marquee_percent')::numeric, 15),
    coalesce((new.royalty_config->>'zero_floor')::boolean, true),
    coalesce(new.royalty_config->>'rounding', 'immediate_whole_point'),
    coalesce((new.royalty_config->>'automatic_unique_enabled')::boolean, new.royalty_enabled),
    coalesce((new.royalty_config->>'automatic_unique_usage_threshold')::integer, 48),
    coalesce((new.unique_config->>'phase_change_deadline_hours')::integer, 24),
    coalesce((new.unique_config->>'mid_phase_replacement_allowed')::boolean, false),
    new.created_by
  ) on conflict (league_id, version) do nothing;
  return new;
end;
$$;

drop trigger if exists league_format_initialize_special_rules_after_insert on public.league_format_configs;
create trigger league_format_initialize_special_rules_after_insert
after insert on public.league_format_configs
for each row execute function public.initialize_special_player_rules_from_format();

create or replace function public.special_player_rules_for_match(
  p_league_id uuid, p_match_number integer
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
  order by rules.effective_from_match_number desc, rules.version desc
  limit 1
$$;

create or replace function public.publish_special_player_rules(
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
  v_fixture public.fixtures%rowtype;
  v_before public.special_player_rule_sets%rowtype;
  v_after public.special_player_rule_sets%rowtype;
  v_version integer;
begin
  if not public.is_league_admin(p_league_id) then raise exception 'League admin access required'; end if;
  if jsonb_typeof(p_rules) is distinct from 'object' then raise exception 'Special-player rules must be a JSON object'; end if;

  select * into v_fixture from public.fixtures
  where league_id = p_league_id and match_number = p_effective_from_match_number;
  if not found then raise exception 'Effective-from match does not exist'; end if;
  if v_fixture.status <> 'scheduled' or now() >= v_fixture.lineup_lock_at then
    raise exception 'Special-player rules must start from an unlocked scheduled match';
  end if;

  select * into v_before from public.special_player_rule_sets
  where league_id = p_league_id and active for update;
  select coalesce(max(version), 0) + 1 into v_version
  from public.special_player_rule_sets where league_id = p_league_id;

  update public.special_player_rule_sets set active = false
  where league_id = p_league_id and active;

  insert into public.special_player_rule_sets (
    league_id, version, effective_from_match_number,
    unique_mode_enabled, unique_players_per_owner,
    other_player_fee_percent, other_player_minimum_fee,
    unique_restrict_captain, unique_restrict_vice_captain,
    unique_restrict_impact, unique_restrict_3x,
    marquee_mode_enabled, marquee_players_per_owner,
    regular_royalty_percent, marquee_royalty_percent,
    royalty_zero_floor, royalty_rounding,
    automatic_unique_enabled, automatic_unique_usage_threshold,
    phase_change_deadline_hours, mid_phase_replacement_allowed,
    active, created_by
  ) values (
    p_league_id, v_version, p_effective_from_match_number,
    coalesce((p_rules->>'unique_mode_enabled')::boolean, false),
    coalesce((p_rules->>'unique_players_per_owner')::integer, 2),
    coalesce((p_rules->>'other_player_fee_percent')::numeric, 30),
    coalesce((p_rules->>'other_player_minimum_fee')::numeric, 15),
    coalesce((p_rules->>'unique_restrict_captain')::boolean, true),
    coalesce((p_rules->>'unique_restrict_vice_captain')::boolean, true),
    coalesce((p_rules->>'unique_restrict_impact')::boolean, true),
    coalesce((p_rules->>'unique_restrict_3x')::boolean, true),
    coalesce((p_rules->>'marquee_mode_enabled')::boolean, false),
    coalesce((p_rules->>'marquee_players_per_owner')::integer, 2),
    coalesce((p_rules->>'regular_royalty_percent')::numeric, 5),
    coalesce((p_rules->>'marquee_royalty_percent')::numeric, 15),
    coalesce((p_rules->>'royalty_zero_floor')::boolean, true),
    coalesce(p_rules->>'royalty_rounding', 'immediate_whole_point'),
    coalesce((p_rules->>'automatic_unique_enabled')::boolean, true),
    coalesce((p_rules->>'automatic_unique_usage_threshold')::integer, 48),
    coalesce((p_rules->>'phase_change_deadline_hours')::integer, 24),
    coalesce((p_rules->>'mid_phase_replacement_allowed')::boolean, false),
    true, auth.uid()
  ) returning * into v_after;

  update public.league_format_configs
  set unique_players_enabled = v_after.unique_mode_enabled,
      unique_scope = case when v_after.unique_mode_enabled then 'phase' else null end,
      marquee_enabled = v_after.marquee_mode_enabled,
      royalty_enabled = v_after.marquee_mode_enabled,
      unique_config = jsonb_build_object(
        'players_per_owner', v_after.unique_players_per_owner,
        'usage_fee_percent', v_after.other_player_fee_percent,
        'minimum_usage_fee', v_after.other_player_minimum_fee,
        'restrict_captain', v_after.unique_restrict_captain,
        'restrict_vice_captain', v_after.unique_restrict_vice_captain,
        'restrict_impact', v_after.unique_restrict_impact,
        'restrict_3x', v_after.unique_restrict_3x,
        'phase_change_deadline_hours', v_after.phase_change_deadline_hours,
        'mid_phase_replacement_allowed', v_after.mid_phase_replacement_allowed
      ),
      marquee_config = jsonb_build_object('players_per_owner', v_after.marquee_players_per_owner),
      royalty_config = jsonb_build_object(
        'regular_percent', v_after.regular_royalty_percent,
        'marquee_percent', v_after.marquee_royalty_percent,
        'zero_floor', v_after.royalty_zero_floor,
        'rounding', v_after.royalty_rounding,
        'automatic_unique_enabled', v_after.automatic_unique_enabled,
        'automatic_unique_usage_threshold', v_after.automatic_unique_usage_threshold
      )
  where league_id = p_league_id
    and exists (select 1 from public.leagues where id = p_league_id and status = 'setup');

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    p_league_id, auth.uid(), 'special_player_rules_published', 'special_player_rule_set', v_after.id::text,
    case when v_before.id is null then null else to_jsonb(v_before) - 'id' - 'created_at' - 'created_by' end,
    to_jsonb(v_after) - 'id' - 'created_at' - 'created_by'
  );

  return jsonb_build_object(
    'id', v_after.id, 'version', v_after.version,
    'effective_from_match_number', v_after.effective_from_match_number
  );
end;
$$;

alter table public.special_player_rule_sets enable row level security;
create policy special_player_rule_sets_read on public.special_player_rule_sets
  for select to authenticated using (public.is_league_member(league_id));

grant select on public.special_player_rule_sets to authenticated;
revoke insert, update, delete on public.special_player_rule_sets from authenticated;
revoke all on function public.publish_special_player_rules(uuid, integer, jsonb) from public;
grant execute on function public.publish_special_player_rules(uuid, integer, jsonb) to authenticated;
grant execute on function public.special_player_rules_for_match(uuid, integer) to authenticated;

commit;
