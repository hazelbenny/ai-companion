-- AI Companion database schema
-- Run once in the Supabase SQL Editor on a fresh project.
-- Every table has row-level security so users can only ever touch their own rows.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  personality text not null default 'friend',
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------- messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index on messages (conversation_id, created_at);

-- -------------------------------------------------------------------- memories
-- 768 dimensions must match EMBED_DIM in backend/llm.py
create table memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  embedding extensions.vector(768) not null,
  created_at timestamptz not null default now()
);

create index on memories using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------- user settings
create table user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  memory_enabled boolean not null default true
);

-- ------------------------------------------------------------ row-level security
alter table conversations enable row level security;
alter table messages enable row level security;
alter table memories enable row level security;
alter table user_settings enable row level security;

create policy "users manage own conversations" on conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own messages" on messages
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "users manage own memories" on memories
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own settings" on user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------- grants
-- Needed because "Automatically expose new tables" is disabled.
-- Logged-out visitors (the anon role) get no access at all.
grant select, insert, update, delete on conversations to authenticated;
grant select, insert, update, delete on messages to authenticated;
grant select, insert, update, delete on memories to authenticated;
grant select, insert, update, delete on user_settings to authenticated;

-- ------------------------------------------------------- semantic memory search
-- Runs with the caller's permissions, so RLS limits matches to their own memories.
create or replace function match_memories(
  query_embedding extensions.vector(768),
  match_count int default 5
)
returns table (id uuid, content text, similarity float)
language sql stable
as $$
  select m.id, m.content, 1 - (m.embedding <=> query_embedding) as similarity
  from memories m
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_memories(extensions.vector(768), int) to authenticated;