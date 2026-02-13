create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  telegram_id bigint unique not null,
  first_name text,
  last_name text,
  username text,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table users enable row level security;

create policy "Allow all for authenticated flow" on users
  for all using (true) with check (true);
