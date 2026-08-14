-- Fix PL/pgSQL output-column ambiguity in the reminder delivery upsert.
-- The output table exposes `fixture_id`, so an unqualified conflict target
-- named `fixture_id` can be interpreted as either a table column or a PL/pgSQL
-- variable. A targetless ON CONFLICT is correct here because the delivery row
-- has only its generated primary key plus the reminder idempotency constraint.

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
  on conflict do nothing;

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

revoke all on function public.claim_due_match_reminders(integer) from public;
grant execute on function public.claim_due_match_reminders(integer) to service_role;
