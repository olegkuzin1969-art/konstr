create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null default '{}',
  status text not null default 'no_review',
  created_at timestamptz default now()
);

create index if not exists orders_user_id_idx on orders(user_id);

alter table orders enable row level security;

create policy "Allow all for now" on orders
  for all using (true) with check (true);
