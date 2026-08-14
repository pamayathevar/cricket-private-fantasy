-- Private league member presence and chatroom.
-- Presence is an approximate server heartbeat; chat writes are accepted only
-- through guarded RPCs so a client cannot impersonate another league member.
begin;

create unique index if not exists league_members_league_id_id_key
on public.league_members (league_id, id);

create table if not exists public.league_member_presence (
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (league_id, member_id),
  foreign key (league_id, member_id)
    references public.league_members(league_id, id) on delete cascade
);

create table if not exists public.league_chat_messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_member_id uuid references public.league_members(id) on delete set null,
  foreign key (league_id, member_id)
    references public.league_members(league_id, id) on delete cascade,
  check ((deleted_at is null and deleted_by_member_id is null)
      or (deleted_at is not null and deleted_by_member_id is not null))
);

create index if not exists league_member_presence_seen_idx
on public.league_member_presence (league_id, last_seen_at desc);

create index if not exists league_chat_messages_room_idx
on public.league_chat_messages (league_id, created_at desc, id);

alter table public.league_member_presence enable row level security;
alter table public.league_chat_messages enable row level security;

drop policy if exists league_member_presence_read on public.league_member_presence;
create policy league_member_presence_read
on public.league_member_presence for select to authenticated
using (public.is_league_member(league_id));

drop policy if exists league_chat_messages_read on public.league_chat_messages;
create policy league_chat_messages_read
on public.league_chat_messages for select to authenticated
using (public.is_league_member(league_id));

revoke all on table public.league_member_presence from anon, authenticated;
revoke all on table public.league_chat_messages from anon, authenticated;
grant select on table public.league_member_presence to authenticated;
grant select on table public.league_chat_messages to authenticated;

create or replace function public.touch_league_presence(p_league_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_seen_at timestamptz := clock_timestamp();
begin
  v_member_id := public.current_member_id(p_league_id);
  if v_member_id is null then
    raise exception 'Active league membership is required';
  end if;

  insert into public.league_member_presence (league_id, member_id, last_seen_at)
  values (p_league_id, v_member_id, v_seen_at)
  on conflict (league_id, member_id)
  do update set last_seen_at = excluded.last_seen_at;

  return v_seen_at;
end;
$$;

create or replace function public.post_league_chat_message(
  p_league_id uuid,
  p_body text
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

  insert into public.league_chat_messages (league_id, member_id, body)
  values (p_league_id, v_member_id, v_body)
  returning id into v_message_id;

  return v_message_id;
end;
$$;

create or replace function public.remove_league_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_message public.league_chat_messages%rowtype;
  v_member_id uuid;
begin
  select * into v_message
  from public.league_chat_messages
  where id = p_message_id
  for update;

  if not found then
    raise exception 'Chat message was not found';
  end if;

  v_member_id := public.current_member_id(v_message.league_id);
  if v_member_id is null then
    raise exception 'Active league membership is required';
  end if;
  if v_message.member_id <> v_member_id
     and not public.is_league_admin(v_message.league_id) then
    raise exception 'Only the author or a league administrator can remove this message';
  end if;
  if v_message.deleted_at is not null then
    return;
  end if;

  update public.league_chat_messages
  set body = 'Message removed',
      deleted_at = clock_timestamp(),
      deleted_by_member_id = v_member_id
  where id = p_message_id;

  insert into public.audit_events (
    league_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    v_message.league_id,
    auth.uid(),
    'league_chat_message_removed',
    'league_chat_message',
    p_message_id::text,
    jsonb_build_object(
      'author_member_id', v_message.member_id,
      'removed_by_member_id', v_member_id
    )
  );
end;
$$;

revoke all on function public.touch_league_presence(uuid) from public;
revoke all on function public.post_league_chat_message(uuid, text) from public;
revoke all on function public.remove_league_chat_message(uuid) from public;
grant execute on function public.touch_league_presence(uuid) to authenticated;
grant execute on function public.post_league_chat_message(uuid, text) to authenticated;
grant execute on function public.remove_league_chat_message(uuid) to authenticated;

-- Postgres Changes subscriptions remain subject to the SELECT policies above.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'league_member_presence'
    ) then
      alter publication supabase_realtime add table public.league_member_presence;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'league_chat_messages'
    ) then
      alter publication supabase_realtime add table public.league_chat_messages;
    end if;
  end if;
end;
$$;

commit;

-- Rollback: remove both tables from supabase_realtime, then drop the three
-- functions and both tables. Historical audit rows may be retained safely.
