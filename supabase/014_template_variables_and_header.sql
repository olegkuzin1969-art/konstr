-- Таблица переменных (плашки на скрине) + "шапка" шаблона.
-- Переменные управляются админом: добавление через + (modal) и удаление через крестик.
-- В шаблоне переменные используются как {{key}}.

-- 1) Глобальный справочник переменных
create table if not exists template_variables (
  id uuid default gen_random_uuid() primary key,
  key text not null unique,
  label_ru text not null default '',
  label_en text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists template_variables_is_active_idx on template_variables(is_active);
create index if not exists template_variables_sort_order_idx on template_variables(sort_order);

alter table template_variables enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Allow all for now' and tablename = 'template_variables') then
    create policy "Allow all for now" on template_variables for all using (true) with check (true);
  end if;
end $$;

-- Сид переменных "как на скрине" (можно расширять/удалять в админке)
insert into template_variables (key, label_ru, label_en, is_active, sort_order)
values
  ('fullName','ФИО полностью','Full name',true,10),
  ('address','Адрес регистрации и фактического проживания','Registration and actual address',true,20),
  ('passportSeries','Паспорт: серия','Passport: series',true,30),
  ('passportNumber','Паспорт: номер','Passport: number',true,40),
  ('passportIssued','Паспорт: кем и когда выдан','Passport: issued by',true,50),
  ('phone','Контактный телефон','Contact phone',true,60),
  ('ukName','Кому (название УК / ФИО директора)','To (MC name / director)',true,70),
  ('ukAddress','Адрес УК','MC address',true,80),
  ('period','Период начислений','Billing period',true,90),
  ('accountNumber','Номер лицевого счёта (необязательно)','Account number (optional)',true,100),
  ('emailForReply','Email для ответа','Email for reply',true,110),
  ('extraInfo','Иная информация (необязательно)','Other information (optional)',true,120),
  ('inn','ИНН','Tax ID (INN)',true,130),
  ('kpp','КПП','KPP',true,140),
  ('ooo','Наименование организации (ООО/АО)','Organization name (LLC/JSC)',true,150),
  ('legalAddress','Юридический адрес','Legal address',true,160),
  ('postAddress','Почтовый адрес','Postal address',true,170),
  ('bik','БИК банка','Bank BIK',true,180),
  ('bankName','Название банка','Bank name',true,190),
  ('bankAccount','Расчётный счёт','Bank account',true,200),
  ('position','Должность','Position',true,210),
  ('snils','СНИЛС','SNILS',true,220),
  ('birthDate','Дата рождения','Date of birth',true,230),
  ('birthPlace','Место рождения','Place of birth',true,240),
  ('cadastralNumber','Кадастровый номер помещения','Cadastral number',true,250),
  ('contractNumber','Номер договора','Contract number',true,260),
  ('contractDate','Дата договора','Contract date',true,270),
  ('claimAmount','Сумма требований (руб.)','Claim amount (RUB)',true,280),
  ('reason','Основание (причина запроса)','Reason for request',true,290),
  ('deliveryMethod','Способ получения ответа','Response delivery method',true,300)
on conflict (key) do nothing;

-- 2) Добавляем в шаблоны поля "шапка"
alter table templates
  add column if not exists header_ru text not null default '',
  add column if not exists header_en text not null default '';

-- Заполняем "шапку" для существующего шаблона, если пусто
update templates
set header_ru = 'Кому: {{ukName}}\nОт: {{fullName}}\nПаспорт: серия {{passportSeries}} номер {{passportNumber}}, выдан {{passportIssued}}\nАдрес регистрации: {{address}}\nКонтактный телефон: {{phone}}  Email: {{emailForReply}}',
    header_en = 'To: {{ukName}}\nFrom: {{fullName}}\nPassport: series {{passportSeries}} no. {{passportNumber}}, issued {{passportIssued}}\nAddress: {{address}}\nPhone: {{phone}}  Email: {{emailForReply}}'
where (header_ru = '' or header_ru is null)
  and (body_ru like '%{{fullName}}%' or body_ru like '%{{ukName}}%');

