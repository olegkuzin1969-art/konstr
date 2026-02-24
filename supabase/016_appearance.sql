-- Таблица оформления (глобальные цвета/градиент для всего сайта).
-- Хранится одна запись с id = 1, админ меняет через админ-панель.

create table if not exists appearance (
  id int primary key default 1,
  bg_color text,
  bg_elevated_color text,
  bg_gradient_from text,
  bg_gradient_to text,
  accent_color text,
  border_color text,
  updated_at timestamptz default now()
);

alter table appearance enable row level security;

drop policy if exists "Allow all for now" on appearance;
create policy "Allow all for now" on appearance
  for all using (true) with check (true);

-- Стартовые значения соответствуют текущему дизайну (styles.css).
insert into appearance (id, bg_color, bg_elevated_color, bg_gradient_from, bg_gradient_to, accent_color, border_color)
values (
  1,
  '#e4ebf5',   -- var(--bg)
  '#ecf2ff',   -- var(--bg-elevated)
  '#f5f7fb',   -- body bg gradient from
  '#dfe7f3',   -- body bg gradient to
  '#8b5cf6',   -- var(--accent)
  '#cfd8e7'    -- var(--border)
)
on conflict (id) do nothing;

