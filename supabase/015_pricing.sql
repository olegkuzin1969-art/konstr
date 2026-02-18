-- Таблица с ценами тарифов сервиса (единая строка с актуальными значениями).
create table if not exists pricing (
  id int primary key default 1,
  base_price_rub int not null default 700,
  expert_price_rub int not null default 2200,
  updated_at timestamptz default now()
);

-- Гарантируем, что запись всегда одна (id = 1).
insert into pricing (id, base_price_rub, expert_price_rub)
values (1, 700, 2200)
on conflict (id) do nothing;

