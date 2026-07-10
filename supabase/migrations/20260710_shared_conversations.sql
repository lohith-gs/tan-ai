-- Shareable read-only conversation snapshots — run in the Supabase SQL editor.
--
-- Sharing copies the conversation into a frozen JSONB snapshot. The row id is
-- the unguessable public token (/share/<id>). One share per conversation:
-- re-sharing upserts (same URL, refreshed snapshot). Unshare = delete the row.

create table if not exists shared_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null unique,
  title text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shared_conversations enable row level security;

-- Owners manage their own shares
create policy "owners manage own shares" on shared_conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone with the link can read (id is the unguessable token)
create policy "public read" on shared_conversations
  for select using (true);
