begin;

select
  to_regclass('public.league_match_reminder_preferences') is not null as preferences_installed,
  to_regclass('public.match_reminder_deliveries') is not null as deliveries_installed,
  to_regclass('public.notification_delivery_config') is not null as delivery_config_installed;

select
  has_function_privilege('authenticated', 'public.get_league_match_reminder_preferences(uuid)', 'EXECUTE') as members_can_read_preferences,
  has_function_privilege('authenticated', 'public.set_league_match_reminder_preferences(uuid,boolean,boolean,boolean,boolean)', 'EXECUTE') as members_can_set_preferences,
  not has_function_privilege('anon', 'public.set_league_match_reminder_preferences(uuid,boolean,boolean,boolean,boolean)', 'EXECUTE') as anonymous_cannot_set_preferences,
  not has_function_privilege('authenticated', 'public.claim_due_match_reminders(integer)', 'EXECUTE') as clients_cannot_claim_deliveries,
  has_function_privilege('service_role', 'public.claim_due_match_reminders(integer)', 'EXECUTE') as worker_can_claim_deliveries;

select
  not has_table_privilege('authenticated', 'public.match_reminder_deliveries', 'SELECT,INSERT,UPDATE,DELETE') as deliveries_are_server_only,
  not has_table_privilege('authenticated', 'public.notification_delivery_config', 'SELECT,INSERT,UPDATE,DELETE') as config_is_server_only,
  not has_table_privilege('authenticated', 'public.league_match_reminder_preferences', 'INSERT,UPDATE,DELETE') as preferences_are_rpc_write_only;

select count(*) as invalid_delivery_rows
from public.match_reminder_deliveries delivery
join public.fixtures fixture on fixture.id = delivery.fixture_id
join public.league_members member on member.id = delivery.member_id
where fixture.league_id <> delivery.league_id
   or member.league_id <> delivery.league_id
   or delivery.reminder_offset_minutes not in (1440, 30)
   or delivery.channel not in ('push', 'email');

select
  position('skip locked' in lower(pg_get_functiondef('public.claim_due_match_reminders(integer)'::regprocedure))) > 0 as concurrent_claim_protection,
  position('20 minutes' in pg_get_functiondef('public.claim_due_match_reminders(integer)'::regprocedure)) > 0 as stale_reminder_guard,
  position('status = ''scheduled''' in pg_get_functiondef('public.claim_due_match_reminders(integer)'::regprocedure)) > 0 as scheduled_fixture_guard;

rollback;
