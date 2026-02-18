create table if not exists templates (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text default '',
  content jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists templates_is_active_idx on templates(is_active);
create index if not exists templates_sort_order_idx on templates(sort_order);

alter table templates enable row level security;

create policy "Allow all for now" on templates
  for all using (true) with check (true);

-- Seed default template (Конструктор официальных обращений)
insert into templates (name, description, content, is_active, sort_order)
values (
  'Конструктор официальных обращений — документы-основания начислений',
  'Запрос документов-оснований начислений платы за ЖКУ (оформленный через Конструктор официальных обращений).',
  jsonb_build_object(
    'version', 1,
    'title', jsonb_build_object(
      'ru', 'ЗАПРОС\nо предоставлении документов, послуживших основанием для начисления платы за жилищно-коммунальные услуги\n(в соответствии с Федеральным законом № 402-ФЗ)',
      'en', 'REQUEST\nfor documents forming the basis for housing and коммунal service charges\n(pursuant to Federal Law No. 402-FZ)'
    ),
    'body', jsonb_build_object(
      'ru',
      'Я, {{fullName}}, являюсь собственником/нанимателем жилого помещения по вышеуказанному адресу.\n\n' ||
      'На основании Федерального закона от 04.06.2011 № 402-ФЗ «О внесении изменений в Жилищный кодекс Российской Федерации и отдельные законодательные акты Российской Федерации» ПРОШУ:\n\n' ||
      'Предоставить мне заверенные копии следующих документов (сведений), послуживших основанием для начисления платы за жилищно-коммунальные услуги по моему лицевому счету № {{accountNumber}} за период {{period}}:\n\n' ||
      '- Договор управления многоквартирным домом со всеми приложениями и дополнительными соглашениями.\n' ||
      '- Протоколы общих собраний собственников, на которых утверждались:\n' ||
      '  - размер платы за содержание и ремонт жилого помещения;\n' ||
      '  - перечень услуг и работ по содержанию и ремонту общего имущества;\n' ||
      '  - тарифы на коммунальные услуги (при наличии).\n' ||
      '- Расчет размера платы за коммунальные услуги с указанием применяемых тарифов, нормативов потребления, показаний приборов учета.\n' ||
      '- Акты выполненных работ (оказанных услуг) по содержанию и ремонту общего имущества за указанный период.\n' ||
      '- Сведения о наличии (отсутствии) задолженности по оплате жилищно-коммунальных услуг с детализацией по видам услуг.\n' ||
      '- Иные документы, на основании которых производились начисления по моему лицевому счету.\n\n' ||
      'Способ получения ответа:\n' ||
      'Прошу направить письменный ответ с приложением заверенных копий документов почтовым отправлением по вышеуказанному адресу / выдать на руки при личном обращении (нужное подчеркнуть).\n\n' ||
      'Дата: «»______ 20   г.\n' ||
      'Подпись: _______________ / {{fullName}}',
      'en',
      'I, {{fullName}}, am the owner/tenant of the residential premises at the above address.\n\n' ||
      'Pursuant to Federal Law dated 04.06.2011 No. 402-FZ, I REQUEST:\n\n' ||
      'Please provide certified copies of the following documents (information) that served as the basis for charging fees for my personal account No. {{accountNumber}} for the period {{period}}:\n\n' ||
      '- The building management agreement with all appendices and amendments.\n' ||
      '- Minutes of the general meetings of owners approving:\n' ||
      '  - maintenance and repair fees;\n' ||
      '  - the list of services and works for common property;\n' ||
      '  - communal tariffs (if applicable).\n' ||
      '- Calculation of the fee amount with applied tariffs, consumption norms, and meter readings.\n' ||
      '- Acts of completed works (rendered services) for the specified period.\n' ||
      '- Information on outstanding debt (or absence of debt) with breakdown by service type.\n' ||
      '- Other documents on the basis of which charges were made for my personal account.\n\n' ||
      'Response delivery method:\n' ||
      'Please send a written response with certified copies by mail to the address above / hand over in person (underline as appropriate).\n\n' ||
      'Date ________\n' ||
      'Signature ____________ / {{fullName}}'
    )
  ),
  true,
  0
)
on conflict do nothing;

