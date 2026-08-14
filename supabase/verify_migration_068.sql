begin;

select
  to_regclass('public.league_chat_mentions') is not null as mentions_table_installed,
  to_regclass('public.league_chat_member_state') is not null as member_state_table_installed,
  to_regclass('public.app_push_devices') is not null as push_devices_table_installed,
  to_regclass('public.league_chat_push_deliveries') is not null as push_delivery_table_installed;

select relname, relrowsecurity
from pg_class
where oid in (
  'public.league_chat_mentions'::regclass,
  'public.league_chat_member_state'::regclass,
  'public.app_push_devices'::regclass,
  'public.league_chat_push_deliveries'::regclass
)
order by relname;

select
  has_table_privilege('authenticated', 'public.league_chat_mentions', 'SELECT') as mentions_select,
  not has_table_privilege('authenticated', 'public.league_chat_mentions', 'INSERT,UPDATE,DELETE') as mentions_no_write,
  not has_table_privilege('authenticated', 'public.app_push_devices', 'SELECT,INSERT,UPDATE,DELETE') as devices_rpc_only,
  not has_table_privilege('authenticated', 'public.league_chat_push_deliveries', 'SELECT,INSERT,UPDATE,DELETE') as deliveries_server_only;

select
  has_function_privilege('authenticated', 'public.post_league_chat_message(uuid,text,uuid[])', 'EXECUTE') as mention_post_enabled,
  has_function_privilege('authenticated', 'public.get_league_chat_unread(uuid)', 'EXECUTE') as unread_enabled,
  has_function_privilege('authenticated', 'public.mark_league_chat_read(uuid)', 'EXECUTE') as mark_read_enabled,
  has_function_privilege('authenticated', 'public.set_league_chat_push_enabled(uuid,boolean)', 'EXECUTE') as push_preference_enabled,
  has_function_privilege('authenticated', 'public.register_app_push_device(text,text,text)', 'EXECUTE') as device_registration_enabled,
  not has_function_privilege('anon', 'public.register_app_push_device(text,text,text)', 'EXECUTE') as anon_device_registration_blocked;

select count(*) as cross_league_mention_count
from public.league_chat_mentions mention
join public.league_chat_messages message on message.id = mention.message_id
where message.league_id <> mention.league_id;

select count(*) as wrong_league_mention_recipient_count
from public.league_chat_mentions mention
join public.league_members member on member.id = mention.member_id
where member.league_id <> mention.league_id;

select count(*) as malformed_push_token_count
from public.app_push_devices
where expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$';

rollback;
