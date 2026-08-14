begin;

select
  position('@everyone' in pg_get_functiondef(
    'public.post_league_chat_message(uuid,text,uuid[])'::regprocedure
  )) > 0 as everyone_broadcast_installed,
  has_function_privilege(
    'authenticated',
    'public.post_league_chat_message(uuid,text,uuid[])',
    'EXECUTE'
  ) as authenticated_can_post,
  not has_function_privilege(
    'anon',
    'public.post_league_chat_message(uuid,text,uuid[])',
    'EXECUTE'
  ) as anonymous_cannot_post;

select count(*) as cross_league_mention_count
from public.league_chat_mentions mention
join public.league_chat_messages message on message.id = mention.message_id
where message.league_id <> mention.league_id;

select count(*) as wrong_league_recipient_count
from public.league_chat_mentions mention
join public.league_members member on member.id = mention.member_id
where member.league_id <> mention.league_id;

rollback;
