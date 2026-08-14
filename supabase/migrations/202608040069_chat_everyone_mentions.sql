-- Server-validated @everyone broadcasts for private league chat.
-- The sender is excluded; every other active member in the same league gets
-- one mention row, which drives unread badges and opted-in push delivery.
begin;

create or replace function public.post_league_chat_message(
  p_league_id uuid,
  p_body text,
  p_mentioned_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_message_id uuid;
  v_mention_count integer;
  v_mentions_everyone boolean;
begin
  v_member_id := public.current_member_id(p_league_id);
  if v_member_id is null then
    raise exception 'Active league membership is required';
  end if;
  if char_length(v_body) < 1 then
    raise exception 'Enter a message';
  end if;
  if char_length(v_body) > 500 then
    raise exception 'Messages are limited to 500 characters';
  end if;

  v_mentions_everyone := lower(v_body)
    ~ '(^|[[:space:]])@everyone([[:space:].,!?;:]|$)';

  select count(distinct mentioned_id)
  into v_mention_count
  from unnest(coalesce(p_mentioned_member_ids, array[]::uuid[])) mentioned_id;

  if v_mention_count > 8 then
    raise exception 'A message can notify up to 8 individual members';
  end if;
  if exists (
    select 1
    from (
      select distinct mentioned_id
      from unnest(coalesce(p_mentioned_member_ids, array[]::uuid[])) mentioned_id
    ) requested
    left join public.league_members member
      on member.id = requested.mentioned_id
     and member.league_id = p_league_id
     and member.status = 'active'
    where member.id is null
       or not exists (
         select 1
         from generate_series(1, char_length(v_body)) mention_position
         where substr(lower(v_body), mention_position, char_length(member.display_name) + 1)
                 = '@' || lower(member.display_name)
           and (
             mention_position = 1
             or substr(v_body, mention_position - 1, 1) ~ '[[:space:]]'
           )
           and (
             mention_position + char_length(member.display_name) > char_length(v_body)
             or substr(v_body, mention_position + char_length(member.display_name) + 1, 1)
                  ~ '[[:space:].,!?;:]'
           )
       )
  ) then
    raise exception 'Every notified member must be active and tagged in the message';
  end if;
  if exists (
    select 1
    from public.league_chat_messages message
    where message.league_id = p_league_id
      and message.member_id = v_member_id
      and message.created_at > clock_timestamp() - interval '2 seconds'
  ) then
    raise exception 'Please wait before sending another message';
  end if;
  if 20 <= (
    select count(*)
    from public.league_chat_messages message
    where message.league_id = p_league_id
      and message.member_id = v_member_id
      and message.created_at > clock_timestamp() - interval '1 minute'
  ) then
    raise exception 'Message limit reached. Try again in a minute';
  end if;
  if v_mentions_everyone and exists (
    select 1
    from public.league_chat_messages message
    where message.league_id = p_league_id
      and message.member_id = v_member_id
      and message.created_at > clock_timestamp() - interval '1 minute'
      and lower(message.body) ~ '(^|[[:space:]])@everyone([[:space:].,!?;:]|$)'
  ) then
    raise exception '@everyone can be used once per minute';
  end if;

  insert into public.league_chat_messages (league_id, member_id, body)
  values (p_league_id, v_member_id, v_body)
  returning id into v_message_id;

  if v_mentions_everyone then
    insert into public.league_chat_mentions (message_id, league_id, member_id)
    select v_message_id, p_league_id, member.id
    from public.league_members member
    where member.league_id = p_league_id
      and member.status = 'active'
      and member.id <> v_member_id;
  else
    insert into public.league_chat_mentions (message_id, league_id, member_id)
    select v_message_id, p_league_id, member.id
    from public.league_members member
    join (
      select distinct mentioned_id
      from unnest(coalesce(p_mentioned_member_ids, array[]::uuid[])) mentioned_id
    ) requested on requested.mentioned_id = member.id
    where member.league_id = p_league_id
      and member.status = 'active'
      and member.id <> v_member_id;
  end if;

  return v_message_id;
end;
$$;

revoke all on function public.post_league_chat_message(uuid, text, uuid[]) from public;
grant execute on function public.post_league_chat_message(uuid, text, uuid[]) to authenticated;

commit;

-- Rollback: restore post_league_chat_message(uuid,text,uuid[]) from migration 068.
