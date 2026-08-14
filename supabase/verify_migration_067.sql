-- READ-ONLY VERIFIER: PRIVATE LEAGUE MEMBERS & CHAT
-- Expected: every boolean is true and both final counts are zero.
begin;
set local transaction read only;

select
  to_regclass('public.league_member_presence') is not null as presence_table_installed,
  to_regclass('public.league_chat_messages') is not null as chat_table_installed,
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.league_member_presence'::regclass
  ), false) as presence_rls_enabled,
  coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.league_chat_messages'::regclass
  ), false) as chat_rls_enabled,
  has_table_privilege('authenticated', 'public.league_member_presence', 'SELECT')
    and not has_table_privilege('authenticated', 'public.league_member_presence', 'INSERT,UPDATE,DELETE')
    as presence_is_read_only_to_client,
  has_table_privilege('authenticated', 'public.league_chat_messages', 'SELECT')
    and not has_table_privilege('authenticated', 'public.league_chat_messages', 'INSERT,UPDATE,DELETE')
    as chat_is_read_only_to_client,
  has_function_privilege('authenticated', 'public.touch_league_presence(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.post_league_chat_message(uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.remove_league_chat_message(uuid)', 'EXECUTE')
    as authenticated_can_use_guarded_actions,
  not has_function_privilege('anon', 'public.touch_league_presence(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.post_league_chat_message(uuid,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.remove_league_chat_message(uuid)', 'EXECUTE')
    as anonymous_cannot_use_guarded_actions,
  not exists (
    select 1 from public.league_member_presence presence
    join public.league_members member on member.id = presence.member_id
    where member.league_id <> presence.league_id
  ) as presence_members_are_league_scoped,
  not exists (
    select 1 from public.league_chat_messages message
    join public.league_members member on member.id = message.member_id
    where member.league_id <> message.league_id
  ) as chat_authors_are_league_scoped;

select count(*) as active_member_missing_from_presence_scope
from public.league_member_presence presence
left join public.league_members member
  on member.league_id = presence.league_id and member.id = presence.member_id
where member.id is null;

select count(*) as malformed_removed_message_count
from public.league_chat_messages
where deleted_at is not null and body <> 'Message removed';

rollback;
