-- League chat mentions, unread state, and opt-in Expo push devices.
-- Push tokens never receive direct client table access; registration and
-- preference changes are accepted only through authenticated RPCs.
begin;

create table if not exists public.league_chat_mentions (
  message_id uuid not null references public.league_chat_messages(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (message_id, member_id),
  foreign key (league_id, member_id)
    references public.league_members(league_id, id) on delete cascade
);

create table if not exists public.league_chat_member_state (
  league_id uuid not null references public.leagues(id) on delete cascade,
  member_id uuid not null,
  last_read_at timestamptz not null default now(),
  push_mentions_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (league_id, member_id),
  foreign key (league_id, member_id)
    references public.league_members(league_id, id) on delete cascade
);

create table if not exists public.app_push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  device_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$')
);

create table if not exists public.league_chat_push_deliveries (
  message_id uuid not null references public.league_chat_messages(id) on delete cascade,
  member_id uuid not null references public.league_members(id) on delete cascade,
  expo_push_token text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  expo_ticket_id text,
  error_message text,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (message_id, member_id, expo_push_token)
);

create index if not exists league_chat_mentions_member_unread_idx
on public.league_chat_mentions (league_id, member_id, created_at desc)
where read_at is null;

create index if not exists app_push_devices_user_enabled_idx
on public.app_push_devices (user_id, updated_at desc)
where enabled;

alter table public.league_chat_mentions enable row level security;
alter table public.league_chat_member_state enable row level security;
alter table public.app_push_devices enable row level security;
alter table public.league_chat_push_deliveries enable row level security;

drop policy if exists league_chat_mentions_recipient_read on public.league_chat_mentions;
create policy league_chat_mentions_recipient_read
on public.league_chat_mentions for select to authenticated
using (member_id = public.current_member_id(league_id));

drop policy if exists league_chat_member_state_self_read on public.league_chat_member_state;
create policy league_chat_member_state_self_read
on public.league_chat_member_state for select to authenticated
using (member_id = public.current_member_id(league_id));

revoke all on table public.league_chat_mentions from anon, authenticated;
revoke all on table public.league_chat_member_state from anon, authenticated;
revoke all on table public.app_push_devices from anon, authenticated;
revoke all on table public.league_chat_push_deliveries from anon, authenticated;
grant select on table public.league_chat_mentions to authenticated;
grant select on table public.league_chat_member_state to authenticated;

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

  select count(distinct mentioned_id)
  into v_mention_count
  from unnest(coalesce(p_mentioned_member_ids, array[]::uuid[])) mentioned_id;

  if v_mention_count > 8 then
    raise exception 'A message can notify up to 8 members';
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

  insert into public.league_chat_messages (league_id, member_id, body)
  values (p_league_id, v_member_id, v_body)
  returning id into v_message_id;

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

  return v_message_id;
end;
$$;

create or replace function public.post_league_chat_message(
  p_league_id uuid,
  p_body text
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.post_league_chat_message(p_league_id, p_body, array[]::uuid[]);
$$;

create or replace function public.get_league_chat_unread(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_last_read_at timestamptz;
  v_unread_messages integer;
  v_unread_mentions integer;
  v_push_enabled boolean;
begin
  v_member_id := public.current_member_id(p_league_id);
  if v_member_id is null then
    raise exception 'Active league membership is required';
  end if;

  -- A member's first app session establishes the unread baseline. This avoids
  -- presenting the league's entire historical conversation as newly unread.
  insert into public.league_chat_member_state (league_id, member_id)
  values (p_league_id, v_member_id)
  on conflict (league_id, member_id) do nothing;

  select state.last_read_at, state.push_mentions_enabled
  into v_last_read_at, v_push_enabled
  from public.league_chat_member_state state
  where state.league_id = p_league_id and state.member_id = v_member_id;

  v_last_read_at := coalesce(v_last_read_at, '-infinity'::timestamptz);
  v_push_enabled := coalesce(v_push_enabled, false);

  select count(*) into v_unread_messages
  from public.league_chat_messages message
  where message.league_id = p_league_id
    and message.member_id <> v_member_id
    and message.deleted_at is null
    and message.created_at > v_last_read_at;

  select count(*) into v_unread_mentions
  from public.league_chat_mentions mention
  join public.league_chat_messages message on message.id = mention.message_id
  where mention.league_id = p_league_id
    and mention.member_id = v_member_id
    and mention.read_at is null
    and message.deleted_at is null;

  return jsonb_build_object(
    'unread_messages', v_unread_messages,
    'unread_mentions', v_unread_mentions,
    'push_mentions_enabled', v_push_enabled
  );
end;
$$;

create or replace function public.mark_league_chat_read(p_league_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
  v_read_at timestamptz := clock_timestamp();
begin
  v_member_id := public.current_member_id(p_league_id);
  if v_member_id is null then
    raise exception 'Active league membership is required';
  end if;

  insert into public.league_chat_member_state (league_id, member_id, last_read_at, updated_at)
  values (p_league_id, v_member_id, v_read_at, v_read_at)
  on conflict (league_id, member_id)
  do update set last_read_at = excluded.last_read_at, updated_at = excluded.updated_at;

  update public.league_chat_mentions
  set read_at = v_read_at
  where league_id = p_league_id
    and member_id = v_member_id
    and read_at is null;

  return v_read_at;
end;
$$;

create or replace function public.set_league_chat_push_enabled(
  p_league_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
begin
  v_member_id := public.current_member_id(p_league_id);
  if v_member_id is null then
    raise exception 'Active league membership is required';
  end if;

  insert into public.league_chat_member_state (
    league_id, member_id, push_mentions_enabled, updated_at
  ) values (
    p_league_id, v_member_id, coalesce(p_enabled, false), clock_timestamp()
  )
  on conflict (league_id, member_id)
  do update set
    push_mentions_enabled = excluded.push_mentions_enabled,
    updated_at = excluded.updated_at;

  return coalesce(p_enabled, false);
end;
$$;

create or replace function public.register_app_push_device(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_device_id uuid;
  v_token text := btrim(coalesce(p_expo_push_token, ''));
  v_platform text := lower(btrim(coalesce(p_platform, '')));
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if v_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Invalid Expo push token';
  end if;
  if v_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform';
  end if;

  insert into public.app_push_devices (
    user_id, expo_push_token, platform, device_name, enabled, updated_at
  ) values (
    auth.uid(), v_token, v_platform, nullif(left(btrim(coalesce(p_device_name, '')), 100), ''), true, clock_timestamp()
  )
  on conflict (expo_push_token)
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    enabled = true,
    updated_at = excluded.updated_at
  returning id into v_device_id;

  return v_device_id;
end;
$$;

create or replace function public.disable_app_push_device(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  update public.app_push_devices
  set enabled = false, updated_at = clock_timestamp()
  where user_id = auth.uid()
    and expo_push_token = btrim(coalesce(p_expo_push_token, ''));
end;
$$;

revoke all on function public.post_league_chat_message(uuid, text, uuid[]) from public;
revoke all on function public.get_league_chat_unread(uuid) from public;
revoke all on function public.mark_league_chat_read(uuid) from public;
revoke all on function public.set_league_chat_push_enabled(uuid, boolean) from public;
revoke all on function public.register_app_push_device(text, text, text) from public;
revoke all on function public.disable_app_push_device(text) from public;
grant execute on function public.post_league_chat_message(uuid, text, uuid[]) to authenticated;
grant execute on function public.get_league_chat_unread(uuid) to authenticated;
grant execute on function public.mark_league_chat_read(uuid) to authenticated;
grant execute on function public.set_league_chat_push_enabled(uuid, boolean) to authenticated;
grant execute on function public.register_app_push_device(text, text, text) to authenticated;
grant execute on function public.disable_app_push_device(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'league_chat_mentions'
     ) then
    alter publication supabase_realtime add table public.league_chat_mentions;
  end if;
end;
$$;

commit;

-- Rollback: remove league_chat_mentions from supabase_realtime; drop the six
-- RPCs above, then drop league_chat_push_deliveries, app_push_devices,
-- league_chat_member_state, and league_chat_mentions. Existing messages remain.
