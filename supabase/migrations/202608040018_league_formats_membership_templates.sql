-- Per-league format configuration, owner opt-in lifecycle, and safe rule templates.
begin;

alter table public.league_members drop constraint if exists league_members_status_check;
alter table public.league_members
  add constraint league_members_status_check
  check (status in ('invited', 'accepted', 'declined', 'active', 'suspended', 'withdrawn', 'disabled'));

alter table public.league_members
  add column if not exists invited_at timestamptz not null default now(),
  add column if not exists responded_at timestamptz,
  add column if not exists invitation_expires_at timestamptz,
  add column if not exists participation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(participation_metadata) = 'object');

create index if not exists league_members_status_idx
  on public.league_members (league_id, status, role);

create table public.league_format_configs (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  acquisition_mode text not null default 'auction'
    check (acquisition_mode in ('auction', 'all_open')),
  ownership_enabled boolean not null default true,
  bidding_enabled boolean not null default true,
  other_owner_deductions_enabled boolean not null default true,
  marquee_enabled boolean not null default false,
  marquee_config jsonb not null default '{}'::jsonb check (jsonb_typeof(marquee_config) = 'object'),
  unique_players_enabled boolean not null default false,
  unique_scope text check (unique_scope in ('match', 'phase', 'league')),
  unique_conflict_policy text not null default 'earliest_valid_submission'
    check (unique_conflict_policy in ('earliest_valid_submission', 'admin_allocation')),
  unique_config jsonb not null default '{}'::jsonb check (jsonb_typeof(unique_config) = 'object'),
  royalty_enabled boolean not null default false,
  royalty_config jsonb not null default '{}'::jsonb check (jsonb_typeof(royalty_config) = 'object'),
  setup_status text not null default 'draft' check (setup_status in ('draft', 'published', 'locked')),
  locked_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not unique_players_enabled or unique_scope is not null),
  check (unique_players_enabled or unique_scope is null),
  check (
    (acquisition_mode = 'auction' and ownership_enabled)
    or (acquisition_mode = 'all_open' and not ownership_enabled and not bidding_enabled and not other_owner_deductions_enabled)
  )
);

create table public.league_templates (
  id uuid primary key default gen_random_uuid(),
  source_league_id uuid references public.leagues(id) on delete set null,
  name text not null,
  description text,
  version integer not null default 1 check (version > 0),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  is_public boolean not null default false,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_league_id, name, version)
);

create trigger league_format_configs_set_updated_at
before update on public.league_format_configs
for each row execute function public.set_updated_at();

create trigger league_templates_set_updated_at
before update on public.league_templates
for each row execute function public.set_updated_at();

create or replace function public.protect_started_league_format()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.leagues where id = new.league_id;
  if tg_op = 'UPDATE' and v_status <> 'setup' and new is distinct from old then
    raise exception 'League format cannot be changed after league setup';
  end if;
  if new.setup_status = 'locked' and new.locked_at is null then new.locked_at := now(); end if;
  return new;
end;
$$;

create trigger protect_started_league_format_before_write
before update on public.league_format_configs
for each row execute function public.protect_started_league_format();

insert into public.league_format_configs (
  league_id, acquisition_mode, ownership_enabled, bidding_enabled,
  other_owner_deductions_enabled, marquee_enabled, unique_players_enabled,
  royalty_enabled, setup_status, locked_at, created_by
)
select league.id, 'auction', true, true, true, false, false, false,
  case when league.status = 'setup' then 'draft' else 'locked' end,
  case when league.status = 'setup' then null else now() end,
  league.created_by
from public.leagues league
on conflict (league_id) do nothing;

alter table public.league_format_configs enable row level security;
alter table public.league_templates enable row level security;

create policy league_format_configs_read on public.league_format_configs
  for select to authenticated using (public.is_league_member(league_id));
create policy league_format_configs_admin_all on public.league_format_configs
  for all to authenticated using (public.is_league_admin(league_id))
  with check (public.is_league_admin(league_id));

create policy league_templates_read on public.league_templates
  for select to authenticated using (
    is_public or created_by = auth.uid()
    or (source_league_id is not null and public.is_league_admin(source_league_id))
  );
create policy league_templates_creator_update on public.league_templates
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy league_templates_creator_delete on public.league_templates
  for delete to authenticated using (created_by = auth.uid());

-- Invitation rows are discoverable only by the linked user; active members retain the existing policy.
create policy members_self_invitation_read on public.league_members
  for select to authenticated using (user_id = auth.uid());
create policy leagues_self_invitation_read on public.leagues
  for select to authenticated using (
    exists (select 1 from public.league_members member
      where member.league_id = leagues.id and member.user_id = auth.uid())
  );

grant select on public.league_format_configs, public.league_templates to authenticated;
grant insert, update, delete on public.league_format_configs, public.league_templates to authenticated;

create or replace function public.link_membership_to_existing_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.user_id is null then
    select auth_user.id into new.user_id
    from auth.users auth_user
    where lower(auth_user.email) = lower(new.email::text)
    order by auth_user.created_at
    limit 1;
  end if;
  return new;
end;
$$;

create trigger league_members_link_existing_auth_before_write
before insert or update of email on public.league_members
for each row execute function public.link_membership_to_existing_auth_user();

create or replace function public.link_auth_user_to_memberships()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.league_members
     set user_id = new.id, updated_at = now()
   where user_id is null
     and lower(email::text) = lower(new.email)
     and status in ('invited', 'accepted', 'declined', 'active', 'suspended', 'withdrawn');
  return new;
end;
$$;

create or replace function public.invite_league_member(
  p_league_id uuid, p_email text, p_display_name text,
  p_role text default 'owner', p_invitation_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_owner_limit integer;
  v_current_count integer;
  v_previous_status text;
begin
  if not public.is_league_admin(p_league_id) then raise exception 'League admin access required'; end if;
  if nullif(trim(p_email), '') is null or position('@' in p_email) < 2 then raise exception 'Valid email is required'; end if;
  if nullif(trim(p_display_name), '') is null then raise exception 'Display name is required'; end if;
  if p_role not in ('league_admin', 'owner') then raise exception 'Invite role must be league_admin or owner'; end if;
  if p_invitation_expires_at is not null and p_invitation_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;

  select owner_limit into v_owner_limit from public.leagues where id = p_league_id for update;
  select count(*) into v_current_count from public.league_members
  where league_id = p_league_id and role in ('league_admin', 'owner')
    and status not in ('declined', 'withdrawn', 'disabled');

  select id, status into v_member_id, v_previous_status
  from public.league_members where league_id = p_league_id and lower(email::text) = lower(trim(p_email));
  if v_member_id is null and v_current_count >= v_owner_limit then
    raise exception 'League owner limit of % has been reached', v_owner_limit;
  end if;
  if v_previous_status in ('active', 'suspended') then
    raise exception 'Existing participating member cannot be replaced by an invitation';
  end if;

  insert into public.league_members (
    league_id, email, display_name, role, status, invited_at, responded_at, invitation_expires_at
  ) values (
    p_league_id, lower(trim(p_email))::citext, trim(p_display_name), p_role,
    'invited', now(), null, p_invitation_expires_at
  )
  on conflict (league_id, email) do update set
    display_name = excluded.display_name, role = excluded.role, status = 'invited',
    invited_at = now(), responded_at = null,
    invitation_expires_at = excluded.invitation_expires_at, updated_at = now()
  returning id into v_member_id;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (p_league_id, auth.uid(), 'league_member_invited', 'league_member', v_member_id::text,
    case when v_previous_status is null then null else jsonb_build_object('status', v_previous_status) end,
    jsonb_build_object('status', 'invited', 'email', lower(trim(p_email)), 'role', p_role,
      'invitation_expires_at', p_invitation_expires_at));
  return v_member_id;
end;
$$;

create or replace function public.respond_to_league_invitation(p_league_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.league_members%rowtype;
  v_status text;
begin
  if p_accept is null then raise exception 'Invitation response is required'; end if;
  select * into v_member from public.league_members
  where league_id = p_league_id and user_id = auth.uid()
  for update;
  if not found then raise exception 'League invitation not found'; end if;
  if v_member.status not in ('invited', 'accepted', 'declined') then
    raise exception 'Invitation cannot be changed from status %', v_member.status;
  end if;
  if v_member.invitation_expires_at is not null and now() > v_member.invitation_expires_at then
    raise exception 'League invitation has expired';
  end if;

  v_status := case when p_accept then 'accepted' else 'declined' end;
  update public.league_members
  set status = v_status, responded_at = now(), joined_at = case when p_accept then coalesce(joined_at, now()) else joined_at end
  where id = v_member.id;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (p_league_id, auth.uid(), 'league_invitation_responded', 'league_member', v_member.id::text,
    jsonb_build_object('status', v_member.status), jsonb_build_object('status', v_status));
  return v_status;
end;
$$;

create or replace function public.set_league_member_participation(
  p_league_id uuid, p_member_id uuid, p_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.league_members%rowtype;
begin
  if not public.is_league_admin(p_league_id) then raise exception 'League admin access required'; end if;
  if p_status is null or p_status not in ('invited', 'active', 'suspended', 'withdrawn', 'disabled') then
    raise exception 'Invalid admin participation status';
  end if;
  select * into v_member from public.league_members
  where id = p_member_id and league_id = p_league_id for update;
  if not found then raise exception 'League member not found'; end if;
  if p_status = 'active' and v_member.status not in ('accepted', 'active', 'suspended') then
    raise exception 'Member must accept the invitation before activation';
  end if;

  update public.league_members set status = p_status,
    joined_at = case when p_status = 'active' then coalesce(joined_at, now()) else joined_at end
  where id = p_member_id;
  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (p_league_id, auth.uid(), 'league_member_status_changed', 'league_member', p_member_id::text,
    jsonb_build_object('status', v_member.status), jsonb_build_object('status', p_status));
  return p_status;
end;
$$;

create or replace function public.save_league_template(
  p_source_league_id uuid, p_name text, p_description text default null, p_is_public boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_id uuid;
  v_version integer;
  v_configuration jsonb;
begin
  if not public.is_league_admin(p_source_league_id) then raise exception 'League admin access required'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Template name is required'; end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.league_templates where source_league_id = p_source_league_id and name = trim(p_name);

  select jsonb_build_object(
    'schema_version', 1,
    'source_league', jsonb_build_object(
      'competition', league.competition, 'timezone', league.timezone,
      'owner_limit', league.owner_limit, 'squad_limit', league.squad_limit
    ),
    'format', coalesce((select to_jsonb(config) - 'league_id' - 'created_by' - 'created_at' - 'updated_at' - 'locked_at'
      from public.league_format_configs config where config.league_id = league.id), '{}'::jsonb),
    'lineup_rules', coalesce((select to_jsonb(rules) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'version' - 'active'
      from public.lineup_rule_sets rules where rules.league_id = league.id order by rules.version desc limit 1), '{}'::jsonb),
    'scoring_rules', coalesce((select rules.rules from public.scoring_rule_sets rules
      where rules.league_id = league.id order by rules.version desc limit 1), '{}'::jsonb),
    'phases', coalesce((select jsonb_agg(to_jsonb(phase) - 'id' - 'league_id' - 'created_at' - 'updated_at' order by phase.sort_order)
      from public.league_phases phase where phase.league_id = league.id and phase.active), '[]'::jsonb),
    'transfer_periods', coalesce((select jsonb_agg(to_jsonb(period) - 'id' - 'league_id' - 'created_by' - 'created_at' - 'updated_at' order by period.sort_order)
      from public.league_transfer_periods period where period.league_id = league.id and period.active), '[]'::jsonb),
    'boosters', coalesce((select jsonb_agg(to_jsonb(booster) - 'id' - 'league_id' - 'created_at' - 'updated_at' order by booster.code)
      from public.booster_rules booster where booster.league_id = league.id and booster.active), '[]'::jsonb),
    'owner_invitations', coalesce((select jsonb_agg(jsonb_build_object('email', member.email::text, 'display_name', member.display_name, 'role', member.role) order by member.display_name)
      from public.league_members member where member.league_id = league.id and member.role in ('league_admin', 'owner')), '[]'::jsonb)
  ) into v_configuration
  from public.leagues league where league.id = p_source_league_id;

  if v_configuration is null then raise exception 'Source league not found'; end if;
  insert into public.league_templates (source_league_id, name, description, version, configuration, is_public, created_by)
  values (p_source_league_id, trim(p_name), p_description, v_version, v_configuration, p_is_public, auth.uid())
  returning id into v_template_id;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (p_source_league_id, auth.uid(), 'league_template_saved', 'league_template', v_template_id::text,
    jsonb_build_object('name', trim(p_name), 'version', v_version));
  return v_template_id;
end;
$$;

create or replace function public.create_league_from_template(
  p_template_id uuid, p_slug text, p_name text, p_season_year integer, p_copy_owner_invitations boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.league_templates%rowtype;
  v_config jsonb;
  v_league_id uuid;
  v_admin_member_id uuid;
  v_email citext;
  v_display_name text;
  v_item jsonb;
begin
  if not public.is_any_league_admin() then raise exception 'League admin access required'; end if;
  select * into v_template from public.league_templates where id = p_template_id and active;
  if not found then raise exception 'League template not found'; end if;
  if not (v_template.is_public or v_template.created_by = auth.uid()
    or (v_template.source_league_id is not null and public.is_league_admin(v_template.source_league_id))) then
    raise exception 'League template access required';
  end if;
  if p_slug is null or p_slug <> lower(p_slug) or p_slug !~ '^[a-z0-9][a-z0-9-]*$' then
    raise exception 'Slug must contain lowercase letters, numbers and hyphens';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'League name is required'; end if;
  if p_season_year not between 2000 and 2200 then raise exception 'Invalid season year'; end if;

  v_config := v_template.configuration;
  select email::citext, coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1))
  into v_email, v_display_name from auth.users where id = auth.uid();
  if v_email is null then raise exception 'Authenticated email is required'; end if;

  insert into public.leagues (slug, name, competition, season_year, status, timezone, owner_limit, squad_limit, created_by)
  values (p_slug, trim(p_name), coalesce(v_config#>>'{source_league,competition}', 'Cricket'), p_season_year, 'setup',
    coalesce(v_config#>>'{source_league,timezone}', 'Asia/Kolkata'),
    coalesce((v_config#>>'{source_league,owner_limit}')::integer, 10),
    coalesce((v_config#>>'{source_league,squad_limit}')::integer, 30), auth.uid())
  returning id into v_league_id;

  insert into public.league_members (league_id, user_id, email, display_name, role, status, joined_at, responded_at)
  values (v_league_id, auth.uid(), v_email, v_display_name, 'league_admin', 'active', now(), now())
  returning id into v_admin_member_id;

  insert into public.league_format_configs (
    league_id, acquisition_mode, ownership_enabled, bidding_enabled, other_owner_deductions_enabled,
    marquee_enabled, marquee_config, unique_players_enabled, unique_scope,
    unique_conflict_policy, unique_config, royalty_enabled, royalty_config, setup_status, created_by
  ) values (
    v_league_id, coalesce(v_config#>>'{format,acquisition_mode}', 'auction'),
    coalesce((v_config#>>'{format,ownership_enabled}')::boolean, true),
    coalesce((v_config#>>'{format,bidding_enabled}')::boolean, true),
    coalesce((v_config#>>'{format,other_owner_deductions_enabled}')::boolean, true),
    coalesce((v_config#>>'{format,marquee_enabled}')::boolean, false), coalesce(v_config#>'{format,marquee_config}', '{}'::jsonb),
    coalesce((v_config#>>'{format,unique_players_enabled}')::boolean, false), v_config#>>'{format,unique_scope}',
    coalesce(v_config#>>'{format,unique_conflict_policy}', 'earliest_valid_submission'), coalesce(v_config#>'{format,unique_config}', '{}'::jsonb),
    coalesce((v_config#>>'{format,royalty_enabled}')::boolean, false), coalesce(v_config#>'{format,royalty_config}', '{}'::jsonb),
    'draft', auth.uid()
  );

  insert into public.lineup_rule_sets (
    league_id, version, name, lineup_size, lineup_budget, min_batters, min_bowlers,
    min_wicketkeepers, min_all_rounders, max_from_one_team, captain_multiplier,
    vice_captain_multiplier, impact_enabled, impact_multiplier, impact_batting_enabled,
    impact_bowling_enabled, impact_fielding_enabled, impact_bonus_enabled,
    impact_can_be_captain, carry_forward_enabled, reveal_lineups_after_lock,
    other_owner_penalty_percent, other_owner_minimum_penalty, active, created_by,
    effective_from_match_number
  ) values (
    v_league_id, 1, 'Playing rules v1',
    coalesce((v_config#>>'{lineup_rules,lineup_size}')::integer, 11), coalesce((v_config#>>'{lineup_rules,lineup_budget}')::numeric, 100),
    coalesce((v_config#>>'{lineup_rules,min_batters}')::integer, 2), coalesce((v_config#>>'{lineup_rules,min_bowlers}')::integer, 2),
    coalesce((v_config#>>'{lineup_rules,min_wicketkeepers}')::integer, 1), coalesce((v_config#>>'{lineup_rules,min_all_rounders}')::integer, 1),
    coalesce((v_config#>>'{lineup_rules,max_from_one_team}')::integer, 7), coalesce((v_config#>>'{lineup_rules,captain_multiplier}')::numeric, 2),
    coalesce((v_config#>>'{lineup_rules,vice_captain_multiplier}')::numeric, 1.5), coalesce((v_config#>>'{lineup_rules,impact_enabled}')::boolean, true),
    coalesce((v_config#>>'{lineup_rules,impact_multiplier}')::numeric, 2), coalesce((v_config#>>'{lineup_rules,impact_batting_enabled}')::boolean, true),
    coalesce((v_config#>>'{lineup_rules,impact_bowling_enabled}')::boolean, true), coalesce((v_config#>>'{lineup_rules,impact_fielding_enabled}')::boolean, false),
    coalesce((v_config#>>'{lineup_rules,impact_bonus_enabled}')::boolean, false), coalesce((v_config#>>'{lineup_rules,impact_can_be_captain}')::boolean, false),
    coalesce((v_config#>>'{lineup_rules,carry_forward_enabled}')::boolean, true), coalesce((v_config#>>'{lineup_rules,reveal_lineups_after_lock}')::boolean, true),
    coalesce((v_config#>>'{lineup_rules,other_owner_penalty_percent}')::numeric, 30), coalesce((v_config#>>'{lineup_rules,other_owner_minimum_penalty}')::numeric, 15),
    true, auth.uid(), 1
  );

  insert into public.scoring_rule_sets (league_id, version, name, rules, active, created_by, effective_from_match_number)
  values (v_league_id, 1, 'Points rules v1', coalesce(v_config->'scoring_rules', '{}'::jsonb), true, auth.uid(), 1);

  for v_item in select value from jsonb_array_elements(coalesce(v_config->'phases', '[]'::jsonb)) loop
    insert into public.league_phases (league_id, code, name, sort_order, start_match_number, end_match_number, active)
    values (v_league_id, v_item->>'code', v_item->>'name', (v_item->>'sort_order')::integer,
      (v_item->>'start_match_number')::integer, (v_item->>'end_match_number')::integer, true);
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(v_config->'transfer_periods', '[]'::jsonb)) loop
    insert into public.league_transfer_periods (league_id, code, name, start_match_number, end_match_number,
      transfer_limit, first_match_free, sort_order, active, created_by)
    values (v_league_id, v_item->>'code', v_item->>'name', (v_item->>'start_match_number')::integer,
      (v_item->>'end_match_number')::integer, (v_item->>'transfer_limit')::integer,
      coalesce((v_item->>'first_match_free')::boolean, true), (v_item->>'sort_order')::integer, true, auth.uid());
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(v_config->'boosters', '[]'::jsonb)) loop
    insert into public.booster_rules (league_id, code, name, description, usage_level, total_usage_limit,
      phase_usage_limits, player_multiplier, match_multiplier, unlimited_transfers, retain_changed_lineup,
      allows_captain_stack, allows_vice_captain_stack, allows_impact_stack, active)
    values (v_league_id, v_item->>'code', v_item->>'name', v_item->>'description', v_item->>'usage_level',
      (v_item->>'total_usage_limit')::integer, coalesce(v_item->'phase_usage_limits', '{}'::jsonb),
      (v_item->>'player_multiplier')::numeric, (v_item->>'match_multiplier')::numeric,
      coalesce((v_item->>'unlimited_transfers')::boolean, false), coalesce((v_item->>'retain_changed_lineup')::boolean, false),
      coalesce((v_item->>'allows_captain_stack')::boolean, false), coalesce((v_item->>'allows_vice_captain_stack')::boolean, false),
      coalesce((v_item->>'allows_impact_stack')::boolean, false), true);
  end loop;

  if p_copy_owner_invitations then
    for v_item in select value from jsonb_array_elements(coalesce(v_config->'owner_invitations', '[]'::jsonb)) loop
      if lower(v_item->>'email') <> lower(v_email::text) then
        insert into public.league_members (league_id, email, display_name, role, status)
        values (v_league_id, (v_item->>'email')::citext, v_item->>'display_name',
          case when v_item->>'role' = 'league_admin' then 'league_admin' else 'owner' end, 'invited')
        on conflict (league_id, email) do nothing;
      end if;
    end loop;
  end if;

  insert into public.audit_events (league_id, actor_user_id, action, entity_type, entity_id, after_data)
  values (v_league_id, auth.uid(), 'league_created_from_template', 'league', v_league_id::text,
    jsonb_build_object('template_id', p_template_id, 'template_version', v_template.version,
      'copied_owner_invitations', p_copy_owner_invitations, 'ownership_copied', false));
  return v_league_id;
end;
$$;

revoke all on function public.respond_to_league_invitation(uuid, boolean) from public;
revoke all on function public.invite_league_member(uuid, text, text, text, timestamptz) from public;
revoke all on function public.set_league_member_participation(uuid, uuid, text) from public;
revoke all on function public.save_league_template(uuid, text, text, boolean) from public;
revoke all on function public.create_league_from_template(uuid, text, text, integer, boolean) from public;
grant execute on function public.respond_to_league_invitation(uuid, boolean) to authenticated;
grant execute on function public.invite_league_member(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.set_league_member_participation(uuid, uuid, text) to authenticated;
grant execute on function public.save_league_template(uuid, text, text, boolean) to authenticated;
grant execute on function public.create_league_from_template(uuid, text, text, integer, boolean) to authenticated;

commit;
