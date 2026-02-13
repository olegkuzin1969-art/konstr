create table if not exists login_codes (
  code text primary key,
  telegram_id bigint not null,
  first_name text,
  last_name text,
  username text,
  photo_url text,
  created_at timestamptz default now()
);

alter table login_codes enable row level security;

create policy "Allow all" on login_codes for all using (true) with check (true);
