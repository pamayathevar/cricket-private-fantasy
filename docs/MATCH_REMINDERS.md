# Match reminder notifications

## User behavior

Each active league member can independently opt in to:

- a push reminder 24 hours before the official fixture start;
- a push reminder 30 minutes before the official fixture start;
- an optional email at either reminder time when league email delivery is configured.

Preferences are per league. Push permission is requested only when a member
turns on a push reminder in the installed iOS or Android app. Tapping a push
reminder opens that league and fixture. Email uses the address attached to the
member's authenticated league membership.

Only fixtures whose status remains `scheduled` are eligible. A fixture that has
started, been cancelled, or been abandoned is skipped. Changing a fixture's
`scheduled_start` before a reminder is claimed automatically moves its reminder
window because the queue is derived from the current fixture time.

## Architecture

1. `league_match_reminder_preferences` stores four opt-in switches per member.
2. Supabase Cron invokes `dispatch-match-reminders` every five minutes.
3. `claim_due_match_reminders` creates and atomically claims due delivery rows.
4. The Edge Function sends push through Expo or email through Resend.
5. `match_reminder_deliveries` records every attempt and prevents duplicate
   fixture/member/time/channel delivery.

The worker considers a reminder due for 20 minutes after its exact target time.
This tolerates a delayed five-minute cron run without sending stale reminders.
Failed provider calls retry with a short exponential delay, up to three claims.
A worker that stops after claiming a row can be reclaimed after ten minutes.

## Production setup

Apply migrations `070` and `071`, then deploy the worker:

```bash
npx supabase functions deploy dispatch-match-reminders --no-verify-jwt
```

Generate one long random scheduler secret. Store the same value as:

- Edge Function secret `MATCH_REMINDER_CRON_SECRET`;
- Supabase Vault secret `match_reminder_cron_secret`.

Store the project URL in Vault as `project_url`, then run
`supabase/configure_match_reminder_cron.sql`. The job calls the worker every five
minutes. The worker rejects requests without the scheduler secret.

Supabase documents this Cron + Vault + Edge Function pattern in
[Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).

## Optional email setup

Email is deliberately disabled until a transactional sender is configured.

1. Verify a dedicated sending domain or subdomain with Resend.
2. Set Edge Function secrets `RESEND_API_KEY` and `REMINDER_FROM_EMAIL`.
   `REMINDER_FROM_EMAIL` must be a complete sender such as
   `IPL 2026 <reminders@updates.example.com>`.
3. Enable the server capability:

```sql
update public.notification_delivery_config
set email_reminders_enabled = true, updated_at = now()
where singleton;
```

The app then enables the email switches. See Resend's
[Supabase integration guide](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase).

To disable email immediately without changing member preferences:

```sql
update public.notification_delivery_config
set email_reminders_enabled = false, updated_at = now()
where singleton;
```

## Operations and monitoring

Check the scheduler:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'dispatch-match-reminders-every-five-minutes';

select status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid from cron.job
  where jobname = 'dispatch-match-reminders-every-five-minutes'
)
order by start_time desc
limit 20;
```

Check delivery outcomes:

```sql
select channel, reminder_offset_minutes, status, count(*)
from public.match_reminder_deliveries
group by channel, reminder_offset_minutes, status
order by channel, reminder_offset_minutes, status;
```

Provider errors are retained in `error_message`; Expo ticket IDs or Resend email
IDs are retained in `provider_message_id`. No privileged provider credential or
device token is exposed to authenticated clients.

## QA cases

- Turn on both push times, close the app, and use a test fixture inside each due
  window. Confirm exactly one alert per selected time.
- Tap the alert and confirm the correct league and fixture open.
- Deny phone permission and confirm the app explains that push is blocked.
- Move a future fixture time and confirm only the new reminder window is used.
- Mark a fixture `live`, `cancelled`, or `abandoned` before the due window and
  confirm no reminder row is sent.
- Invoke the worker twice and confirm the unique delivery key prevents duplicates.
- Enable email only after provider setup; confirm push and email can be selected
  independently.
