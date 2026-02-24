create table if not exists texts (
  id uuid default gen_random_uuid() primary key,
  key text not null,
  lang text not null,
  value text not null default '',
  updated_at timestamptz default now(),
  unique (key, lang)
);

alter table texts enable row level security;

drop policy if exists "Allow all for now" on texts;
create policy "Allow all for now" on texts
  for all using (true) with check (true);

