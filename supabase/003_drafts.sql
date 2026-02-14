create table if not exists drafts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists drafts_user_id_idx on drafts(user_id);

alter table drafts enable row level security;

create policy "Allow all for now" on drafts
  for all using (true) with check (true);
