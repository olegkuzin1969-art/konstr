-- Миграция: новая модель статусов (approved: null | true | false)
-- null = заказ в работе
-- true = готов (можно скачать)
-- false = на доработку (revision_comment обязателен)
alter table orders drop column if exists revision_comment;
alter table orders add column if not exists approved boolean default null;
alter table orders add column if not exists revision_comment text default '';

-- Миграция существующих данных: status -> approved
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'status'
  ) then
    update orders set approved = case
      when status in ('no_review', 'ready') then true
      when status = 'revision' then false
      else null
    end;
    alter table orders drop column status;
  end if;
end $$;
