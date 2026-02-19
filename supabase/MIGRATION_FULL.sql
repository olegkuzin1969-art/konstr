-- =============================================================================
-- ПОЛНАЯ МИГРАЦИЯ SUPABASE НА НОВЫЙ АККАУНТ
-- Запускать в SQL Editor нового проекта по порядку. Всё в одном файле.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. USERS
-- -----------------------------------------------------------------------------
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

drop policy if exists "Allow all for authenticated flow" on users;
create policy "Allow all for authenticated flow" on users
  for all using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 2. USERS: колонка administrator (админ-панель)
-- -----------------------------------------------------------------------------
alter table users add column if not exists administrator boolean not null default false;

-- -----------------------------------------------------------------------------
-- 3. LOGIN_CODES (вход по коду из Telegram)
-- -----------------------------------------------------------------------------
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

drop policy if exists "Allow all" on login_codes;
create policy "Allow all" on login_codes for all using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 4. DRAFTS (черновики конструктора)
-- -----------------------------------------------------------------------------
create table if not exists drafts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists drafts_user_id_idx on drafts(user_id);

alter table drafts enable row level security;

drop policy if exists "Allow all for now" on drafts;
create policy "Allow all for now" on drafts
  for all using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 5. ORDERS (заказы пользователей)
-- -----------------------------------------------------------------------------
create table if not exists orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null default '{}',
  approved boolean default null,
  revision_comment text default '',
  created_at timestamptz default now()
);

create index if not exists orders_user_id_idx on orders(user_id);

alter table orders enable row level security;

drop policy if exists "Allow all for now" on orders;
create policy "Allow all for now" on orders
  for all using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 6. PAYMENT_INTENTS (намерения оплаты, до создания заказа)
-- -----------------------------------------------------------------------------
create table if not exists payment_intents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  order_data jsonb not null default '{}',
  with_expert boolean not null default false,
  amount_kop integer not null,
  yookassa_payment_id text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create index if not exists payment_intents_user_id_idx on payment_intents(user_id);
create index if not exists payment_intents_yookassa_id_idx on payment_intents(yookassa_payment_id);
create index if not exists payment_intents_status_idx on payment_intents(status);

alter table payment_intents enable row level security;

drop policy if exists "Allow all for now" on payment_intents;
create policy "Allow all for now" on payment_intents
  for all using (true) with check (true);

-- -----------------------------------------------------------------------------
-- 7. TEMPLATES (шаблоны обращений: заголовок, шапка, тело)
-- -----------------------------------------------------------------------------
drop table if exists templates;

create table templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text default '',
  header_ru text not null default '',
  header_en text not null default '',
  title_ru text not null default '',
  title_en text not null default '',
  body_ru text not null default '',
  body_en text not null default '',
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index templates_is_active_idx on templates(is_active);
create index templates_sort_order_idx on templates(sort_order);

alter table templates enable row level security;

drop policy if exists "Allow all for now" on templates;
create policy "Allow all for now" on templates
  for all using (true) with check (true);

-- Стартовый шаблон «Конструктор официальных обращений»
insert into templates (name, description, header_ru, header_en, title_ru, title_en, body_ru, body_en, is_active, sort_order)
values (
  'Конструктор официальных обращений — документы-основания начислений',
  'Запрос документов-оснований начислений платы за ЖКУ (оформленный через Конструктор официальных обращений).',
  'Кому: {{ukName}}\nОт: {{fullName}}\nПаспорт: серия {{passportSeries}} номер {{passportNumber}}, выдан {{passportIssued}}\nАдрес регистрации: {{address}}\nКонтактный телефон: {{phone}}  Email: {{emailForReply}}',
  'To: {{ukName}}\nFrom: {{fullName}}\nPassport: series {{passportSeries}} no. {{passportNumber}}, issued {{passportIssued}}\nAddress: {{address}}\nPhone: {{phone}}  Email: {{emailForReply}}',
  'ЗАПРОС
о предоставлении документов, послуживших основанием для начисления платы за жилищно-коммунальные услуги
(в соответствии с Федеральным законом № 402-ФЗ)',
  'REQUEST
for documents forming the basis for housing and communal service charges
(pursuant to Federal Law No. 402-FZ)',
  'Я, {{fullName}}, являюсь собственником/нанимателем жилого помещения по вышеуказанному адресу.

На основании Федерального закона от 04.06.2011 № 402-ФЗ «О внесении изменений в Жилищный кодекс Российской Федерации и отдельные законодательные акты Российской Федерации» ПРОШУ:

Предоставить мне заверенные копии следующих документов (сведений), послуживших основанием для начисления платы за жилищно-коммунальные услуги по моему лицевому счету № {{accountNumber}} за период {{period}}:

- Договор управления многоквартирным домом со всеми приложениями и дополнительными соглашениями.
- Протоколы общих собраний собственников, на которых утверждались:
  - размер платы за содержание и ремонт жилого помещения;
  - перечень услуг и работ по содержанию и ремонту общего имущества;
  - тарифы на коммунальные услуги (при наличии).
- Расчет размера платы за коммунальные услуги с указанием применяемых тарифов, нормативов потребления, показаний приборов учета.
- Акты выполненных работ (оказанных услуг) по содержанию и ремонту общего имущества за указанный период.
- Сведения о наличии (отсутствии) задолженности по оплате жилищно-коммунальных услуг с детализацией по видам услуг.
- Иные документы, на основании которых производились начисления по моему лицевому счету.

Способ получения ответа:
Прошу направить письменный ответ с приложением заверенных копий документов почтовым отправлением по вышеуказанному адресу / выдать на руки при личном обращении (нужное подчеркнуть).

Дата: «»______ 20   г.
Подпись: _______________ / {{fullName}}',
  'I, {{fullName}}, am the owner/tenant of the residential premises at the above address.

Pursuant to Federal Law dated 04.06.2011 No. 402-FZ, I REQUEST:

Please provide certified copies of the following documents (information) that served as the basis for charging fees for my personal account No. {{accountNumber}} for the period {{period}}:

- The building management agreement with all appendices and amendments.
- Minutes of the general meetings of owners approving:
  - maintenance and repair fees;
  - the list of services and works for common property;
  - communal tariffs (if applicable).
- Calculation of the fee amount with applied tariffs, consumption norms, and meter readings.
- Acts of completed works (rendered services) for the specified period.
- Information on outstanding debt (or absence of debt) with breakdown by service type.
- Other documents on the basis of which charges were made for my personal account.

Response delivery method:
Please send a written response with certified copies by mail to the address above / hand over in person (underline as appropriate).

Date ________
Signature ____________ / {{fullName}}',
  true,
  0
);

-- -----------------------------------------------------------------------------
-- 8. TEMPLATE_VARIABLES (справочник переменных для шаблонов)
-- -----------------------------------------------------------------------------
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

drop policy if exists "Allow all for now" on template_variables;
create policy "Allow all for now" on template_variables for all using (true) with check (true);

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

-- -----------------------------------------------------------------------------
-- 9. PRICING (тарифы: база и с экспертом)
-- -----------------------------------------------------------------------------
create table if not exists pricing (
  id int primary key default 1,
  base_price_rub int not null default 700,
  expert_price_rub int not null default 2200,
  updated_at timestamptz default now()
);

insert into pricing (id, base_price_rub, expert_price_rub)
values (1, 700, 2200)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 10. BLOG: посты и комментарии
-- -----------------------------------------------------------------------------
create table if not exists blog_posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references users(id) on delete set null,
  title_ru text not null default '',
  title_en text not null default '',
  body_ru text not null default '',
  body_en text not null default '',
  media jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists blog_posts_created_at_idx on blog_posts(created_at desc);

create table if not exists blog_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references blog_posts(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  author_name text not null default '',
  text text not null default '',
  created_at timestamptz default now()
);

create index if not exists blog_comments_post_id_idx on blog_comments(post_id);

alter table blog_posts enable row level security;
alter table blog_comments enable row level security;

drop policy if exists "Allow read blog_posts" on blog_posts;
create policy "Allow read blog_posts" on blog_posts for select using (true);
drop policy if exists "Allow read blog_comments" on blog_comments;
create policy "Allow read blog_comments" on blog_comments for select using (true);
drop policy if exists "Allow insert blog_comments" on blog_comments;
create policy "Allow insert blog_comments" on blog_comments for insert with check (true);
drop policy if exists "Allow insert blog_posts" on blog_posts;
create policy "Allow insert blog_posts" on blog_posts for insert with check (true);

drop policy if exists "Allow update blog_comments" on blog_comments;
create policy "Allow update blog_comments" on blog_comments for update using (true) with check (true);
drop policy if exists "Allow delete blog_comments" on blog_comments;
create policy "Allow delete blog_comments" on blog_comments for delete using (true);
drop policy if exists "Allow update blog_posts" on blog_posts;
create policy "Allow update blog_posts" on blog_posts for update using (true) with check (true);
drop policy if exists "Allow delete blog_posts" on blog_posts;
create policy "Allow delete blog_posts" on blog_posts for delete using (true);

-- -----------------------------------------------------------------------------
-- 11. STORAGE: bucket для медиа блога
-- Если блок ниже выдаст ошибку прав: в Dashboard → Storage создайте bucket
-- "blog-media" (public), затем выполните только два create policy для storage.objects.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Allow insert blog-media" on storage.objects;
create policy "Allow insert blog-media" on storage.objects
for insert with check (bucket_id = 'blog-media');

drop policy if exists "Allow read blog-media" on storage.objects;
create policy "Allow read blog-media" on storage.objects
for select using (bucket_id = 'blog-media');

-- -----------------------------------------------------------------------------
-- ГОТОВО. После выполнения:
-- 1. В Dashboard → Settings → API скопируйте Project URL и anon key в .env (SUPABASE_URL, SUPABASE_ANON_KEY).
-- 2. При необходимости: Service Role Key для server-only операций (SUPABASE_SERVICE_KEY).
-- 3. Назначить админа: update users set administrator = true where telegram_id = ВАШ_TELEGRAM_ID;
-- =============================================================================
