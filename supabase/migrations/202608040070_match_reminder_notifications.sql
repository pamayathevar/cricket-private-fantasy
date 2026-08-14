-- Per-member match reminders with idempotent push/email delivery claims.
-- Delivery is performed by the dispatch-match-reminders Edge Function. A
-- Supabase Cron job invokes that worker every five minutes after deployment.
begin;

create table if not exists public.notification_delivery_config (
  singleton boolean primary key default true check (singleton),
  email_reminders_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.notification_delivery_config (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.league_match_reminder_preferences (
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null,
  push_24h_enabled boolean not null default false,
  push_30m_enabled boolean not null default false,
  email_24h_enabled boolean not null default false,
  email_30m_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (league_id, member_id),
  foreign key (league_id, member_id)
    references public.league_members(league_id, id) on delete cascade
);

create table if not exists public.match_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null,
  reminder_offset_minutes integer not null check (reminder_offset_minutes in (1440, 30)),
  channel text not null check (channel in ('push', 'email')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'partial', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  next_attempt_at timestamptz not null default now(),
  attempted_at timestamptz,
  completed_at timestamptz,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (league_id, member_id)
    references public.league_members(league_id, id) on delete cascade,
  unique (fixture_id, member_id, reminder_offset_minutes, channel)
);

create index if not exists fixtures_scheduled_reminder_idx
on public.fixtures (scheduled_start)
where status = 'scheduled';

create index if not exists match_reminder_deliveries_claim_idx
on public.match_reminder_deliveries (status, next_attempt_at, scheduled_for)
where status in ('pending', 'sending', 'failed');

alter table public.notification_delivery_config enable row level security;
alter table public.league_match_reminder_preferences enable row level security;
alter table public.match_reminder_deliveries enable row level security;

drop policy if exists league_match_reminder_preferences_self_read on public.league_match_reminder_preferences;
create policy league_match_reminder_preferences_self_read
on public.league_match_reminder_preferences for select to authenticated
using (member_id = public.current_member_id(league_id));

revoke all on table public.notification_delivery_config from anon, authenticated;
revoke all on table public.league_match_reminder_preferences from anon, authenticated;
revoke all on table public.match_reminder_deliveries from anon, authenticated;
grant select on table public.league_match_reminder_preferences to authenticated;

create or replace function public.get_league_match_reminder_preferences(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.league_members%rowtype;
  v_preferences public.league_match_reminder_preferences%rowtype;
  v_email_available boolean;
begin
  select * into v_member
  from public.league_members member
  where member.id = public.current_member_id(p_league_id)
    and member.league_id = p_league_id
    and member.status = 'active';

  if v_member.id is null then
    raise exception 'Active league membership is required';
  end if;

  insert into public.league_match_reminder_preferences (league_id, member_id)
  values (p_league_id, v_member.id)
  on conflict (league_id, member_id) do nothing;

  select * into v_preferences
  from public.league_match_reminder_preferences preference
  where preference.league_id = p_league_id
    and preference.member_id = v_member.id;

  select coalesce(config.email_reminders_enabled, false)
  into v_email_available
  from public.notification_delivery_config config
  where config.singleton;

  return jsonb_build_object(
    'push_24h_enabled', v_preferences.push_24h_enabled,
    'push_30m_enabled', v_preferences.push_30m_enabled,
    'email_24h_enabled', v_preferences.email_24h_enabled,
    'email_30m_enabled', v_preferences.email_30m_enabled,
    'email_available', coalesce(v_email_available, false),
    'email', v_member.email::text
  );
end;
$$;

create or replace function public.set_league_match_reminder_preferences(
  p_league_id uuid,
  p_push_24h_enabled boolean,
  p_push_30m_enabled boolean,
  p_email_24h_enabled boolean,
  p_email_30m_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_email_available boolean;
begin
  v_member_id := public.current_member_id(p_league_id);
  if v_member_id is null then
    raise exception 'Active league membership is required';
  end if;

  select coalesce(config.email_reminders_enabled, false)
  into v_email_available
  from public.notification_delivery_config config
  where config.singleton;

  if (coalesce(p_email_24h_enabled, false) or coalesce(p_email_30m_enabled, false))
     and not coalesce(v_email_available, false) then
    raise exception 'Email reminders are not configured yet';
  end if;

  insert into public.league_match_reminder_preferences (
    league_id,
    member_id,
    push_24h_enabled,
    push_30m_enabled,
    email_24h_enabled,
    email_30m_enabled,
    updated_at
  ) values (
    p_league_id,
    v_member_id,
    coalesce(p_push_24h_enabled, false),
    coalesce(p_push_30m_enabled, false),
    coalesce(p_email_24h_enabled, false),
    coalesce(p_email_30m_enabled, false),
    clock_timestamp()
  )
  on conflict (league_id, member_id)
  do update set
    push_24h_enabled = excluded.push_24h_enabled,
    push_30m_enabled = excluded.push_30m_enabled,
    email_24h_enabled = excluded.email_24h_enabled,
    email_30m_enabled = excluded.email_30m_enabled,
    updated_at = excluded.updated_at;

  return public.get_league_match_reminder_preferences(p_league_id);
end;
$$;

create or replace function public.claim_due_match_reminders(p_batch_size integer default 100)
returns table (
  delivery_id uuid,
  fixture_id uuid,
  league_id uuid,
  member_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  recipient_name text,
  league_name text,
  league_timezone text,
  match_number integer,
  home_team text,
  away_team text,
  scheduled_start timestamptz,
  reminder_offset_minutes integer,
  channel text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.match_reminder_deliveries (
    fixture_id,
    league_id,
    member_id,
    reminder_offset_minutes,
    channel,
    scheduled_for,
    next_attempt_at
  )
  select
    fixture.id,
    fixture.league_id,
    preference.member_id,
    reminder.offset_minutes,
    reminder.delivery_channel,
    fixture.scheduled_start - make_interval(mins => reminder.offset_minutes),
    clock_timestamp()
  from public.fixtures fixture
  join public.league_match_reminder_preferences preference
    on preference.league_id = fixture.league_id
  join public.league_members member
    on member.id = preference.member_id
   and member.league_id = fixture.league_id
   and member.status = 'active'
   and member.user_id is not null
  cross join public.notification_delivery_config config
  cross join lateral (
    values
      (1440, 'push'::text, preference.push_24h_enabled),
      (30, 'push'::text, preference.push_30m_enabled),
      (1440, 'email'::text, preference.email_24h_enabled and config.email_reminders_enabled),
      (30, 'email'::text, preference.email_30m_enabled and config.email_reminders_enabled)
  ) reminder(offset_minutes, delivery_channel, enabled)
  where config.singleton
    and reminder.enabled
    and fixture.status = 'scheduled'
    and fixture.scheduled_start > clock_timestamp()
    and fixture.scheduled_start - make_interval(mins => reminder.offset_minutes) <= clock_timestamp()
    and fixture.scheduled_start - make_interval(mins => reminder.offset_minutes) > clock_timestamp() - interval '20 minutes'
  on conflict (fixture_id, member_id, reminder_offset_minutes, channel) do nothing;

  return query
  with claimable as (
    select delivery.id
    from public.match_reminder_deliveries delivery
    join public.fixtures fixture on fixture.id = delivery.fixture_id
    where (
        delivery.status in ('pending', 'failed')
        or (delivery.status = 'sending' and delivery.attempted_at < clock_timestamp() - interval '10 minutes')
      )
      and delivery.attempt_count < 3
      and delivery.next_attempt_at <= clock_timestamp()
      and delivery.scheduled_for <= clock_timestamp()
      and delivery.scheduled_for > clock_timestamp() - interval '20 minutes'
      and fixture.status = 'scheduled'
      and fixture.scheduled_start > clock_timestamp()
    order by delivery.scheduled_for, delivery.created_at
    for update of delivery skip locked
    limit greatest(1, least(coalesce(p_batch_size, 100), 500))
  ), claimed as (
    update public.match_reminder_deliveries delivery
    set status = 'sending',
        attempt_count = delivery.attempt_count + 1,
        attempted_at = clock_timestamp(),
        updated_at = clock_timestamp(),
        error_message = null
    from claimable
    where delivery.id = claimable.id
    returning delivery.*
  )
  select
    claimed.id,
    fixture.id,
    fixture.league_id,
    member.id,
    member.user_id,
    member.email::text,
    member.display_name,
    league.name,
    league.timezone,
    fixture.match_number,
    home.code,
    away.code,
    fixture.scheduled_start,
    claimed.reminder_offset_minutes,
    claimed.channel,
    claimed.attempt_count
  from claimed
  join public.fixtures fixture on fixture.id = claimed.fixture_id
  join public.leagues league on league.id = fixture.league_id
  join public.league_members member
    on member.id = claimed.member_id
   and member.league_id = fixture.league_id
   and member.status = 'active'
  join public.cricket_teams home on home.id = fixture.home_team_id
  join public.cricket_teams away on away.id = fixture.away_team_id;
end;
$$;

create or replace function public.complete_match_reminder_delivery(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('sent', 'partial', 'failed', 'skipped') then
    raise exception 'Invalid reminder delivery status';
  end if;

  update public.match_reminder_deliveries delivery
  set status = p_status,
      provider_message_id = nullif(left(coalesce(p_provider_message_id, ''), 300), ''),
      error_message = nullif(left(coalesce(p_error_message, ''), 500), ''),
      completed_at = case when p_status in ('sent', 'partial', 'skipped') then clock_timestamp() else null end,
      next_attempt_at = case
        when p_status = 'failed' then clock_timestamp() + make_interval(mins => greatest(1, power(2, delivery.attempt_count)::integer))
        else delivery.next_attempt_at
      end,
      updated_at = clock_timestamp()
  where delivery.id = p_delivery_id
    and delivery.status = 'sending';
end;
$$;

revoke all on function public.get_league_match_reminder_preferences(uuid) from public;
revoke all on function public.set_league_match_reminder_preferences(uuid, boolean, boolean, boolean, boolean) from public;
revoke all on function public.claim_due_match_reminders(integer) from public;
revoke all on function public.complete_match_reminder_delivery(uuid, text, text, text) from public;
grant execute on function public.get_league_match_reminder_preferences(uuid) to authenticated;
grant execute on function public.set_league_match_reminder_preferences(uuid, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.claim_due_match_reminders(integer) to service_role;
grant execute on function public.complete_match_reminder_delivery(uuid, text, text, text) to service_role;

commit;

-- Email remains unavailable until RESEND_API_KEY and REMINDER_FROM_EMAIL are
-- configured on the Edge Function and the singleton config row is explicitly
-- enabled by a service operator. See docs/MATCH_REMINDERS.md.
