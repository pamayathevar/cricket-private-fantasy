-- Run only after both secrets exist with the SAME random value:
--   1. Edge Function secret: MATCH_REMINDER_CRON_SECRET
--   2. Vault secret:         match_reminder_cron_secret
-- Also create a Vault secret named project_url containing the Supabase project
-- URL, for example https://project-ref.supabase.co.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_existing_job_id bigint;
  v_project_url text;
  v_cron_secret text;
begin
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'project_url';

  select decrypted_secret into v_cron_secret
  from vault.decrypted_secrets
  where name = 'match_reminder_cron_secret';

  if nullif(v_project_url, '') is null then
    raise exception 'Vault secret project_url is required';
  end if;
  if nullif(v_cron_secret, '') is null then
    raise exception 'Vault secret match_reminder_cron_secret is required';
  end if;

  select jobid into v_existing_job_id
  from cron.job
  where jobname = 'dispatch-match-reminders-every-five-minutes';
  if v_existing_job_id is not null then
    perform cron.unschedule(v_existing_job_id);
  end if;

  perform cron.schedule(
    'dispatch-match-reminders-every-five-minutes',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'project_url'), '/') || '/functions/v1/dispatch-match-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'match_reminder_cron_secret')
        ),
        body := jsonb_build_object('invoked_at', clock_timestamp())
      ) as request_id;
    $cron$
  );
end;
$$;

select jobid, jobname, schedule, active
from cron.job
where jobname = 'dispatch-match-reminders-every-five-minutes';
