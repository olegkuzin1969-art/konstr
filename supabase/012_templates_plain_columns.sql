-- Новая структура таблицы шаблонов: только текстовые поля, без JSON.
-- Админ заполняет поля в конструкторе — в БД сохраняются title_ru, title_en, body_ru, body_en.

drop table if exists templates;

create table templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text default '',
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

create policy "Allow all for now" on templates
  for all using (true) with check (true);

-- Стартовый шаблон «Конструктор официальных обращений» (пример для админа)
insert into templates (name, description, title_ru, title_en, body_ru, body_en, is_active, sort_order)
values (
  'Конструктор официальных обращений — документы-основания начислений',
  'Запрос документов-оснований начислений платы за ЖКУ (оформленный через Конструктор официальных обращений).',
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
