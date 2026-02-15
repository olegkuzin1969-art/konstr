// Конструкт — фронтенд, демо-режим без бэкенда

const state = {
  route: "home",
  lang: "ru",
  user: null,
  token: null,
  documents: [],
  draft: null,
  blogPosts: [],
  constructorForm: {
    fullName: "",
    address: "",
    ukName: "",
    ukAddress: "",
    period: "",
    emailForReply: "",
    services: {
      content: true,
      heating: false,
      water: false,
      repair: false,
    },
  },
  withExpert: false,
  checkoutOrderId: null,
  isLoading: false,
  profileTab: "drafts",
  editingDraftId: null,
};

// ========== AUTH (TMA + Telegram Widget → Supabase, 1 аккаунт по telegram_id) ==========

const API_BASE = ''; // тот же домен

function isInTelegramWebApp() {
  return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
}

async function fetchConfig() {
  const r = await fetch(API_BASE + '/api/config');
  return r.json();
}

async function authViaTelegram(type, payload) {
  const r = await fetch(API_BASE + '/api/auth-telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || 'Auth failed');
  }
  return r.json();
}

async function tryTmaLogin() {
  if (!isInTelegramWebApp()) return false;
  const initData = window.Telegram.WebApp.initData;
  if (!initData) return false;
  try {
    const { user } = await authViaTelegram('tma', { initData });
    state.user = { ...user, photo_url: user.photo_url };
    localStorage.setItem('user', JSON.stringify(state.user));
    if (window.Telegram?.WebApp?.ready) window.Telegram.WebApp.ready();
    if (window.Telegram?.WebApp?.expand) window.Telegram.WebApp.expand();
    return true;
  } catch (e) {
    console.warn('TMA auth failed:', e);
    return false;
  }
}

async function loginByCode(code) {
  const res = await authViaTelegram('code', { code });
  state.user = { ...res.user };
  if (res.token) state.token = res.token;
  localStorage.setItem('user', JSON.stringify(state.user));
  if (res.token) localStorage.setItem('drafts_token', res.token);
  closeProfileDropdown();
  updateProfileUI();
  render();
  if (typeof window !== 'undefined' && window.history) {
    window.history.replaceState({}, '', window.location.pathname || '/');
  }
}

function checkSavedAuth() {
  const saved = localStorage.getItem('user');
  if (saved) {
    try {
      state.user = JSON.parse(saved);
    } catch {}
  }
  const tok = localStorage.getItem('drafts_token');
  if (tok) state.token = tok;
}

async function initAuth() {
  checkSavedAuth();
  if (state.user) {
    updateProfileUI();
    return;
  }
  if (await tryTmaLogin()) {
    updateProfileUI();
    return;
  }
  const urlCode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code');
  if (urlCode) {
    try {
      await loginByCode(urlCode);
      return;
    } catch (e) {
      alert(state.lang === 'ru' ? 'Код неверный или истёк' : 'Invalid or expired code');
    }
  }
  updateProfileUI();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('user');
  localStorage.removeItem('drafts_token');
  updateProfileUI();
  closeProfileDropdown();
  render();
}

// ========== DRAFTS (API + БД) ==========

async function draftsApi(method, body = {}) {
  const headers = { 'Content-Type': 'application/json' };
  let url = API_BASE + '/api/drafts';
  let payload = { ...body };
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) {
    payload.initData = window.Telegram.WebApp.initData;
  } else if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  } else {
    throw new Error('Необходима авторизация');
  }
  if (method === 'GET' && payload.initData) {
    url += '?initData=' + encodeURIComponent(payload.initData);
  }
  const res = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

async function fetchDrafts() {
  const data = await draftsApi('GET');
  return data.drafts || [];
}

async function saveDraftToApi(draftData) {
  const data = await draftsApi('POST', { data: draftData });
  return data.draft;
}

async function updateDraftInApi(id, draftData) {
  const data = await draftsApi('PUT', { id, data: draftData });
  return data.draft;
}

async function deleteDraftFromApi(id) {
  await draftsApi('DELETE', { id });
}

// ========== ORDERS (API + БД) ==========

async function ordersApi(method, body = {}) {
  const headers = { 'Content-Type': 'application/json' };
  let url = API_BASE + '/api/orders';
  let payload = { ...body };
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) {
    payload.initData = window.Telegram.WebApp.initData;
  } else if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  } else {
    throw new Error('Необходима авторизация');
  }
  if (method === 'GET' && payload.initData) {
    url += '?initData=' + encodeURIComponent(payload.initData);
  }
  const res = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

async function fetchOrders() {
  const data = await ordersApi('GET');
  return data.orders || [];
}

async function createOrderApi(orderData) {
  const data = await ordersApi('POST', { data: orderData });
  return data.order;
}

async function deleteOrderFromApi(id) {
  const res = await fetch(API_BASE + '/api/orders?id=' + encodeURIComponent(id), {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(isInTelegramWebApp() && window.Telegram?.WebApp?.initData
        ? {}
        : state.token ? { 'Authorization': 'Bearer ' + state.token } : {}),
    },
    body: JSON.stringify(
      isInTelegramWebApp() && window.Telegram?.WebApp?.initData
        ? { id, initData: window.Telegram.WebApp.initData }
        : { id }
    ),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
}

// ========== BLOG (демо) ==========

async function fetchBlogPosts() {
  state.blogPosts = getDemoBlogPosts();
  return state.blogPosts;
}

// ========== DEMO/FALLBACK DATA ==========

function getDemoBlogPosts() {
  return [
    {
      id: "402fz",
      title: {
        ru: "Как составить запрос по 402-ФЗ",
        en: "How to create a request under 402-FZ",
      },
      body: {
        ru: "Федеральный закон № 402-ФЗ регулирует вопросы бухгалтерского учёта и отчётности. При составлении официального запроса важно правильно сослаться на закон и чётко сформулировать цель обращения.",
        en: "Federal Law No. 402-FZ regulates accounting and reporting issues. When drafting an official request, it is important to correctly reference the law and clearly state the purpose of your inquiry.",
      },
      date: "2026-01-15",
      comments: [
        {
          author: "Анна",
          text: "Статья помогла впервые грамотно написать запрос в УК.",
        },
      ],
    },
    {
      id: "uk-rights",
      title: {
        ru: "Права жильцов при общении с УК",
        en: "Residents' rights when dealing with HOA",
      },
      body: {
        ru: "Каждый собственник жилья имеет право запрашивать информацию о расходовании средств, проводимых работах и тарифах. Управляющая компания обязана предоставить ответ в установленные законом сроки.",
        en: "Every homeowner has the right to request information about expenditures, performed works, and tariffs. The management company is required to provide a response within the legally established timeframe.",
      },
      date: "2026-02-01",
      comments: [],
    },
  ];
}

function addCommentLocal(postId, text) {
  if (!text.trim()) return;
  const post = state.blogPosts.find((p) => p.id === postId);
  if (!post) return;
  post.comments.push({
    author: state.user ? state.user.first_name || state.user.username : (state.lang === "ru" ? "Гость" : "Guest"),
    text: text.trim(),
  });
  render();
}

// ========== I18N ==========

const I18N = {
  ru: {
    nav: {
      home: "Главная",
      service: "Услуга",
      blog: "Блог",
      contacts: "Контакты",
      legal: "Документы",
    },
    footer: {
      offer: "Публичная оферта",
      privacy: "Политика конфиденциальности",
    },
    hero: {
      badge: "Сервис «Конструкт» — запросы в УК по 402‑ФЗ",
      title: "Соберите официальный запрос в УК<br />как из конструктора",
      subtitle:
        "Пошаговый конструктор помогает сформировать юридически корректное обращение по 402‑ФЗ: вы отвечаете на простые вопросы — сервис собирает текст и готовит PDF.",
      pills: [
        "Пошаговый конструктор",
        "Черновик PDF до оплаты",
        "Опция проверки экспертом",
      ],
      ctaPrimary: "Заполнить конструктор",
      ctaSecondary: "Посмотреть тарифы",
      tagline:
        "MVP‑версия: один тип документа — «Запрос в УК по 402‑ФЗ», две опции тарифа и ручная проверка в админ‑панели.",
      howTitle: "Как работает «Конструкт»",
      howSteps: [
        "Вы отвечаете на 5–7 вопросов о себе и своей УК.",
        "Параллельно видите черновик письма — без юр. жаргона.",
        "Выбираете тариф: самостоятельно или с проверкой эксперта.",
        "Получаете готовый PDF и инструкции по отправке в УК.",
      ],
    },
    service: {
      title: "Тарифы сервиса",
      subtitle:
        "Начните с базового тарифа или добавьте экспертную проверку текста — структура письма остаётся одинаковой.",
      baseBadge: "Для самостоятельных пользователей",
      baseTitle: "Без проверки",
      basePrice: "700 ₽",
      basePoints: [
        "Пошаговый конструктор запроса.",
        "Черновик PDF до оплаты.",
        "Инструкция по отправке в УК.",
      ],
      baseButton: "Собрать запрос",
      expertBadge: "Рекомендуемый вариант",
      expertTitle: "С проверкой эксперта",
      expertPrice: "2 200 ₽",
      expertPoints: [
        "Всё из тарифа «Без проверки».",
        "Ручная проверка юристом.",
        "Комментарий и финальный PDF.",
      ],
      expertButton: "Начать с проверкой",
    },
    constructor: {
      title: "Мини‑демо конструктора",
      subtitle:
        "Ниже — укороченная версия формы из продукта. Все данные хранятся только в памяти страницы.",
      fullName: "ФИО",
      fullNamePlaceholder: "Иванов Иван Иванович",
      address: "Адрес проживания",
      addressPlaceholder: "г. Москва, ул. Пример, д. 1, кв. 1",
      ukName: "Название УК",
      ukNamePlaceholder: "ООО «УК Пример»",
      ukAddress: "Адрес УК",
      ukAddressPlaceholder: "г. Москва, ул. Управляющая, д. 10",
      period: "Период начислений",
      periodPlaceholder: "Например: с января по март 2026 года",
      services: "Услуги",
      servicesOptions: {
        content: "Содержание и коммунальные услуги",
        heating: "Отопление",
        water: "Водоснабжение",
        repair: "Ремонт общедомового имущества",
      },
      email: "Email для ответа (необязательно)",
      emailPlaceholder: "Если хотите получить ответ по email",
      withExpert: "Хочу проверку эксперта (+1 500 ₽)",
      saveDraft: "Сохранить черновик",
      createOrder: "Создать заказ",
      hint:
        "В полноценной версии после заполнения формы откроется выбор тарифа и виджет оплаты. Здесь мы показываем только UX конструктора.",
      previewTitle: "Черновик письма",
      previewSubtitle:
        "Предпросмотр обновляется при каждом изменении полей. В реальном продукте на этом шаге будет PDF‑просмотрщик.",
    },
    blog: {
      title: "Блог о защите прав и ЖКХ",
      subtitle:
        "В продукте здесь будет серия статей и кейсов. Сейчас мы показываем одну ключевую публикацию и блок комментариев.",
      badge: "Статья",
      articleTitle: "Как использовать 402‑ФЗ против управляющей компании",
      articleBody:
        "Идея простая: вы не сразу пишете жалобу, а сначала требуете у УК документы по закону о бухгалтерском учёте. Без документов сложно спорить про «завышенные начисления» — поэтому «Конструкт» фокусируется на правильном запросе.",
      steps: [
        "Понимаете, какие документы можно запросить.",
        "Формируете аккуратный запрос по 402‑ФЗ и ЖК РФ.",
        "Используете ответ УК как доказательство в жалобах и исках.",
      ],
      commentsTitle: "Комментарии",
      commentsEmpty: "Пока нет комментариев. Будьте первым.",
      commentsLabel: "Оставить комментарий",
      commentsPlaceholder: "Поделитесь опытом или задайте вопрос...",
      commentsButton: "Отправить",
    },
    contacts: {
      title: "Контакты",
      subtitle:
        "В демо‑версии контактные данные условные. В продакшене здесь появятся актуальные реквизиты и ссылки на соцсети.",
      supportEmail: "Email поддержки",
      telegram: "Telegram",
      formTitle: "Форма обратной связи (демо)",
      nameLabel: "Имя",
      namePlaceholder: "Как к вам обращаться",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      messageLabel: "Сообщение",
      messagePlaceholder: "Кратко опишите вопрос или запрос",
      sendButton: "Отправить (демо)",
      sendAlert:
        "Сообщение не отправляется на сервер — это демо‑лендинг. В продакшене здесь будет интеграция с почтой или CRM.",
    },
    legal: {
      offerTitle: "Публичная оферта",
      privacyTitle: "Политика конфиденциальности",
      backLink: "На главную",
      offerPage: `
<h2>1. Общие положения</h2>
<p>Настоящая публичная оферта (далее — Оферта) является официальным предложением сервиса «Конструкт» (далее — Исполнитель) заключить договор оказания услуг на условиях, изложенных ниже, с любым физическим лицом (далее — Пользователь), которое примет условия настоящей Оферты.</p>
<p>Акцептом Оферты в соответствии со статьёй 438 Гражданского кодекса РФ является факт оплаты услуг Пользователем.</p>

<h2>2. Термины и определения</h2>
<p><strong>Сервис</strong> — веб-сайт и мини-приложение «Конструкт», доступные в Telegram и в браузере.</p>
<p><strong>Услуга</strong> — формирование текста официального запроса в управляющую компанию (УК) в соответствии с Федеральным законом № 402-ФЗ «О бухгалтерском учёте», подготовка черновика в формате PDF, а при выборе соответствующего тарифа — юридическая проверка документа экспертом.</p>
<p><strong>Документ</strong> — сформированный запрос в формате PDF, готовый к отправке в УК.</p>

<h2>3. Предмет договора</h2>
<p>Исполнитель обязуется оказать Пользователю Услугу в соответствии с выбранным тарифом, а Пользователь обязуется оплатить Услугу в размере и порядке, предусмотренных настоящей Офертой.</p>

<h2>4. Тарифы и стоимость</h2>
<p><strong>Базовый тариф (без проверки эксперта)</strong> — 700 рублей. Включает: пошаговый конструктор запроса, черновик PDF до оплаты, готовый документ после оплаты.</p>
<p><strong>Тариф с проверкой эксперта</strong> — 2 200 рублей. Включает всё из базового тарифа плюс ручную проверку юристом, комментарии эксперта и финальный PDF.</p>
<p>Исполнитель вправе изменять стоимость услуг. Актуальные цены указаны на сайте в момент оформления заказа.</p>

<h2>5. Порядок оказания услуг</h2>
<p>5.1. Пользователь заполняет форму конструктора на Сайте, указывая данные о себе, управляющей компании и периоде начислений.</p>
<p>5.2. Сервис формирует черновик текста запроса. Пользователь может сохранять черновики в личном кабинете.</p>
<p>5.3. После оплаты выбранного тарифа Исполнитель предоставляет Пользователю готовый Документ в формате PDF.</p>
<p>5.4. При выборе тарифа с проверкой эксперта срок оказания услуги может составлять до 3 рабочих дней.</p>

<h2>6. Оплата</h2>
<p>Оплата производится способами, указанными на Сайте (банковские карты, системы быстрых платежей и др.). Факт оплаты подтверждается электронным чеком.</p>

<h2>7. Возврат средств</h2>
<p>Возврат оплаты возможен до момента предоставления готового Документа при наличии технической возможности. Запрос направляется на <a href="mailto:support@konstruct.app">support@konstruct.app</a> или в Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

<h2>8. Ответственность</h2>
<p>Исполнитель не несёт ответственности за использование Пользователем сформированного Документа и за действия УК. Сервис предоставляет типовой шаблон запроса; итоговое решение о направлении запроса принимает Пользователь.</p>

<h2>9. Контакты</h2>
<p>По вопросам оферты и услуг: <a href="mailto:support@konstruct.app">support@konstruct.app</a>, Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>
`,
      privacyPage: `
<h2>1. Общие сведения</h2>
<p>Настоящая Политика конфиденциальности (далее — Политика) определяет порядок обработки и защиты персональных данных пользователей сервиса «Конструкт» (далее — Сервис, мы).</p>
<p>Сервис соблюдает требования Федерального закона № 152-ФЗ «О персональных данных» и обеспечивает конфиденциальность и защиту персональных данных.</p>

<h2>2. Оператор персональных данных</h2>
<p>Оператором персональных данных является владелец сервиса «Конструкт». Контактная информация: <a href="mailto:support@konstruct.app">support@konstruct.app</a>, <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

<h2>3. Какие данные мы собираем</h2>
<p><strong>При входе через Telegram Mini App или по коду:</strong></p>
<ul>
<li>Идентификатор пользователя Telegram (telegram_id);</li>
<li>Имя, фамилия, имя пользователя (username) в Telegram;</li>
<li>Фото профиля в Telegram (опционально, при наличии).</li>
</ul>
<p><strong>При использовании конструктора запроса:</strong></p>
<ul>
<li>ФИО;</li>
<li>Адрес проживания;</li>
<li>Название и адрес управляющей компании;</li>
<li>Период начислений;</li>
<li>Email для ответа (опционально).</li>
</ul>

<h2>4. Цели обработки</h2>
<p>Персональные данные обрабатываются в целях:</p>
<ul>
<li>оказания услуг по формированию запросов в УК;</li>
<li>идентификации Пользователя и связи с ним;</li>
<li>сохранения черновиков в личном кабинете;</li>
<li>улучшения качества Сервиса.</li>
</ul>

<h2>5. Правовые основания</h2>
<p>Обработка осуществляется на основании согласия Пользователя, а также для исполнения договора оказания услуг.</p>

<h2>6. Хранение и защита</h2>
<p>Данные хранятся на защищённых серверах с использованием современных средств шифрования. Срок хранения — в течение срока оказания услуг и в соответствии с требованиями законодательства РФ.</p>

<h2>7. Передача третьим лицам</h2>
<p>Персональные данные не передаются третьим лицам, за исключением случаев, предусмотренных законодательством РФ, или при наличии явного согласия Пользователя.</p>

<h2>8. Права Пользователя</h2>
<p>В соответствии с ФЗ-152 вы имеете право:</p>
<ul>
<li>получить информацию об обработке ваших персональных данных;</li>
<li>требовать уточнения, блокирования или удаления данных;</li>
<li>отозвать согласие на обработку.</li>
</ul>
<p>Обращения направляйте на <a href="mailto:support@konstruct.app">support@konstruct.app</a> или в Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

<h2>9. Cookies и технологии</h2>
<p>Сервис использует локальное хранилище браузера (localStorage) для сохранения сессии, настроек и черновиков. Это необходимо для работы личного кабинета и конструктора.</p>

<h2>10. Изменения Политики</h2>
<p>Мы вправе вносить изменения в настоящую Политику. Актуальная версия всегда доступна на данной странице.</p>
`,
    },
    profile: {
      title: "Профиль",
      tabDrafts: "Черновики",
      tabOrders: "Заказы",
      subtitle: "Сохранённые запросы в УК. Нажмите, чтобы продолжить редактирование.",
      empty: "Нет сохранённых черновиков.",
      ordersEmpty: "Нет заказов.",
      orderStatusNoReview: "Без проверки",
      orderOpen: "Открыть",
      deleteOrder: "Удалить",
      orderPreview: "Предпросмотр",
      download: "Скачать",
      close: "Закрыть",
      loginHint: "Войдите, чтобы сохранять черновики и видеть заказы.",
      loadDraft: "Открыть",
      deleteDraft: "Удалить",
    },
    alerts: {
      draftSaved:
        "Черновик конструктора сохранён (локально, в памяти страницы).",
      mustLogin: "Сначала войдите или зарегистрируйтесь.",
      orderCreated: (id) =>
        `Заказ ${id} создан (демо). В реальной версии вы перешли бы на страницу оплаты.`,
      paymentBase:
        "Оплата 700 ₽ успешно 'проведена'. Черновик PDF доступен в личном кабинете (демо).",
      paymentExpert:
        "Оплата 2 200 ₽ успешно 'проведена'. Запрос отправлен эксперту на проверку (демо).",
      enterEmail: "Введите email, чтобы привязать заказ (демо):",
    },
  },
  en: {
    nav: {
      home: "Home",
      service: "Service",
      blog: "Blog",
      contacts: "Contacts",
      legal: "Legal",
    },
    footer: {
      offer: "Public offer",
      privacy: "Privacy policy",
    },
    hero: {
      badge: "Konstruct — requests to the management company under 402‑FZ",
      title: "Build an official request<br />to your management company",
      subtitle:
        "A step‑by‑step form helps you create a legally correct request under 402‑FZ: you answer simple questions — the service assembles the text and prepares a PDF.",
      pills: [
        "Step‑by‑step constructor",
        "Draft PDF before payment",
        "Optional expert review",
      ],
      ctaPrimary: "Open constructor",
      ctaSecondary: "View pricing",
      tagline:
        "MVP: one document type — request under 402‑FZ, two pricing options and manual expert review.",
      howTitle: "How Konstruct works",
      howSteps: [
        "You answer 5–7 questions about yourself and your management company.",
        "You see a live draft of the letter — without legal jargon.",
        "You choose a plan: self‑service or with expert review.",
        "You receive a ready PDF and instructions on how to send it.",
      ],
    },
    service: {
      title: "Service plans",
      subtitle:
        "Start with the base plan or add expert review — the letter structure stays the same.",
      baseBadge: "For self‑service users",
      baseTitle: "Without review",
      basePrice: "700 ₽",
      basePoints: [
        "Step‑by‑step request constructor.",
        "Draft PDF before payment.",
        "Instructions on how to send the letter.",
      ],
      baseButton: "Create request",
      expertBadge: "Recommended",
      expertTitle: "With expert review",
      expertPrice: "2 200 ₽",
      expertPoints: [
        "Everything from the base plan.",
        "Manual review by a lawyer.",
        "Commentary and final PDF.",
      ],
      expertButton: "Start with review",
    },
    constructor: {
      title: "Mini demo of the constructor",
      subtitle:
        "Below is a shortened version of the real form. All data is stored only in the page memory.",
      fullName: "Full name",
      fullNamePlaceholder: "Ivan Ivanov",
      address: "Residential address",
      addressPlaceholder: "Moscow, Example st. 1, apt. 1",
      ukName: "Management company name",
      ukNamePlaceholder: "LLC \"Example MC\"",
      ukAddress: "Management company address",
      ukAddressPlaceholder: "Moscow, Management st. 10",
      period: "Billing period",
      periodPlaceholder: "For example: January–March 2026",
      services: "Services",
      servicesOptions: {
        content: "Housing and communal services",
        heating: "Heating",
        water: "Water supply",
        repair: "Common property repairs",
      },
      email: "Email for reply (optional)",
      emailPlaceholder: "If you want to receive a reply by email",
      withExpert: "I want expert review (+1 500 ₽)",
      saveDraft: "Save draft",
      createOrder: "Create order",
      hint:
        "In the full version you will proceed to plan selection and a payment widget. Here we only showcase the UX.",
      previewTitle: "Letter draft",
      previewSubtitle:
        "The preview updates on every change. In production this will be a PDF viewer.",
    },
    blog: {
      title: "Blog about housing rights",
      subtitle:
        "In the product this section will contain a series of articles and cases. For now we show one key article and comments.",
      badge: "Article",
      articleTitle: "How to use 402‑FZ against a management company",
      articleBody:
        "The idea is simple: instead of filing a complaint right away, you first request documents from the management company under the accounting law. Without documents it is hard to argue about \"overstated charges\", so Konstruct focuses on the correct request.",
      steps: [
        "Understand which documents you can request.",
        "Form a neat written request under 402‑FZ and the Housing Code.",
        "Use the response as evidence in complaints and lawsuits.",
      ],
      commentsTitle: "Comments",
      commentsEmpty: "No comments yet. Be the first one.",
      commentsLabel: "Leave a comment",
      commentsPlaceholder: "Share your experience or ask a question...",
      commentsButton: "Send",
    },
    contacts: {
      title: "Contacts",
      subtitle:
        "In this demo the contact details are fictional. In production you'll see real company details and social links.",
      supportEmail: "Support email",
      telegram: "Telegram",
      formTitle: "Feedback form (demo)",
      nameLabel: "Name",
      namePlaceholder: "How should we address you",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      messageLabel: "Message",
      messagePlaceholder: "Briefly describe your question or request",
      sendButton: "Send (demo)",
      sendAlert:
        "This message is not actually sent — this is a demo landing. In production it will be wired to email or a CRM.",
    },
    legal: {
      offerTitle: "Public offer",
      privacyTitle: "Privacy policy",
      backLink: "Back to Home",
      offerPage: `
<h2>1. General</h2>
<p>This Public Offer (hereinafter — Offer) is an official proposal of the Konstruct service (hereinafter — Provider) to conclude an agreement for the provision of services under the terms set forth below with any individual (hereinafter — User) who accepts these terms.</p>
<p>Acceptance of the Offer constitutes the User's payment for the services.</p>

<h2>2. Terms and definitions</h2>
<p><strong>Service</strong> — the Konstruct website and mini-app available in Telegram and in a browser.</p>
<p><strong>Service provided</strong> — formation of official request text to a management company (MC) under Federal Law No. 402-FZ on accounting, preparation of a draft PDF, and (on selected plans) legal review by an expert.</p>
<p><strong>Document</strong> — the generated request in PDF format, ready for submission to the MC.</p>

<h2>3. Subject matter</h2>
<p>The Provider undertakes to provide the User with the Service according to the selected plan; the User undertakes to pay for the Service in the amount and manner set forth in this Offer.</p>

<h2>4. Plans and pricing</h2>
<p><strong>Base plan (without expert review)</strong> — 700 ₽. Includes: step-by-step constructor, draft PDF before payment, final document after payment.</p>
<p><strong>Plan with expert review</strong> — 2 200 ₽. Includes everything from the base plan plus manual review by a lawyer and final PDF.</p>

<h2>5. Contact</h2>
<p><a href="mailto:support@konstruct.app">support@konstruct.app</a>, Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>
`,
      privacyPage: `
<h2>1. Overview</h2>
<p>This Privacy Policy defines how we collect, process, and protect personal data of users of the Konstruct service.</p>
<p>We comply with applicable data protection laws and ensure confidentiality.</p>

<h2>2. Data we collect</h2>
<p><strong>When signing in via Telegram or code:</strong> Telegram ID, name, username, profile photo.</p>
<p><strong>When using the constructor:</strong> Full name, address, MC name and address, billing period, email.</p>

<h2>3. Purpose</h2>
<p>Data is used to provide the service, form requests, and communicate with you.</p>

<h2>4. Your rights</h2>
<p>You may request access, correction, or deletion of your data. Contact: <a href="mailto:support@konstruct.app">support@konstruct.app</a> or <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

<h2>5. Cookies and storage</h2>
<p>We use localStorage for session and drafts. This is required for the personal account and constructor.</p>
`,
    },
    alerts: {
      draftSaved: "Draft saved (locally in the page memory).",
      mustLogin: "Please log in or sign up first.",
      orderCreated: (id) =>
        `Order ${id} created (demo). In the real version you would proceed to the payment page.`,
      paymentBase:
        "Payment of 700 ₽ was \"processed\". The draft PDF is available in your dashboard (demo).",
      paymentExpert:
        "Payment of 2 200 ₽ was \"processed\". The request was sent to an expert for review (demo).",
      enterEmail: "Enter email to link the order (demo):",
    },
    profile: {
      title: "Profile",
      tabDrafts: "Drafts",
      tabOrders: "Orders",
      subtitle: "Saved requests to MC. Click to continue editing.",
      empty: "No saved drafts.",
      ordersEmpty: "No orders.",
      orderStatusNoReview: "Without review",
      orderOpen: "Open",
      deleteOrder: "Delete",
      orderPreview: "Preview",
      download: "Download",
      close: "Close",
      loginHint: "Log in to save drafts and view orders.",
      loadDraft: "Open",
      deleteDraft: "Delete",
    },
  },
};

// ========== UI HELPERS ==========

const appRoot = document.getElementById("app-root");

function setUser(user) {
  state.user = user;
  render();
}

function updateConstructorField(field, value) {
  state.constructorForm = {
    ...state.constructorForm,
    [field]: value,
  };
  refreshLetterPreview();
}

function toggleService(key) {
  state.constructorForm = {
    ...state.constructorForm,
    services: {
      ...state.constructorForm.services,
      [key]: !state.constructorForm.services[key],
    },
  };
  refreshLetterPreview();
}

function clearConstructorForm() {
  state.constructorForm = {
    fullName: "",
    address: "",
    ukName: "",
    ukAddress: "",
    period: "",
    emailForReply: "",
    services: { content: true, heating: false, water: false, repair: false },
  };
  state.withExpert = false;
  state.editingDraftId = null;
}

async function saveDraft() {
  if (!state.user) {
    alert(I18N[state.lang].alerts.mustLogin);
    return;
  }
  const draftData = {
    ...state.constructorForm,
    withExpert: state.withExpert,
  };
  try {
    const editingId = state.editingDraftId;
    if (editingId) {
      await updateDraftInApi(editingId, draftData);
      clearConstructorForm();
      state.profileDrafts = (state.profileDrafts || []).map((d) =>
        d.id === editingId ? { ...d, data: draftData, updated_at: new Date().toISOString() } : d
      );
      alert(state.lang === 'ru' ? 'Черновик обновлён' : 'Draft updated');
    } else {
      const created = await saveDraftToApi(draftData);
      clearConstructorForm();
      if (created) {
        state.profileDrafts = [{ ...created }, ...(state.profileDrafts || [])];
      }
      alert(state.lang === 'ru' ? 'Черновик сохранён в профиль' : 'Draft saved to profile');
    }
    render();
  } catch (e) {
    alert(state.lang === 'ru' ? 'Ошибка сохранения: ' + (e.message || 'Проверьте подключение') : 'Save error: ' + (e.message || 'Check connection'));
  }
}

async function createOrder() {
  if (!state.user) {
    alert(I18N[state.lang].alerts.mustLogin);
    return;
  }
  if (state.withExpert) {
    alert(state.lang === 'ru' ? 'Оформление заказа с проверкой временно недоступно' : 'Orders with expert review are temporarily unavailable');
    return;
  }
  const orderData = { ...state.constructorForm, withExpert: state.withExpert };
  try {
    const created = await createOrderApi(orderData);
    clearConstructorForm();
    state.profileOrders = [{ ...created }, ...(state.profileOrders || [])];
    alert(state.lang === 'ru' ? 'Заказ оформлен' : 'Order created');
    window.location.hash = '#profile';
    render();
  } catch (e) {
    alert(state.lang === 'ru' ? 'Ошибка: ' + (e.message || 'Проверьте подключение') : 'Error: ' + (e.message || 'Check connection'));
  }
}

function addComment(postId, text) {
  addCommentLocal(postId, text);
}

function getLetterPreviewFromData(f) {
  if (!f) f = state.constructorForm;
  const lang = state.lang;
  const chosenServices = Object.entries(f.services)
    .filter(([, v]) => v)
    .map(([k]) => {
      switch (k) {
        case "content":
          return "содержание и ремонт жилья";
        case "heating":
          return "отопление";
        case "water":
          return "водоснабжение";
        case "repair":
          return "ремонт общедомового имущества";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .map((s) => "– " + s)
    .join("\n");

  const header = lang === "ru"
    ? `Руководителю\n${f.ukName || "___________"}\n${f.ukAddress || "___________"}\n\nОт ${f.fullName || "___________"}\nПроживающего по адресу\n${f.address || "___________"}\n${f.emailForReply ? "Тел./Email: " + f.emailForReply : ""}`
    : `To the head of\n${f.ukName || "___________"}\n${f.ukAddress || "___________"}\n\nFrom ${f.fullName || "___________"}\nResiding at\n${f.address || "___________"}\n${f.emailForReply ? "Tel/Email: " + f.emailForReply : ""}`;

  const bodyIntro = lang === "ru"
    ? "В соответствии с Федеральным законом № 402‑ФЗ «О бухгалтерском учёте» требую предоставить и направить мне по указанному выше адресу правоустанавливающие документы и сведения, подтверждающие начисления и расходы по следующим услугам:"
    : "In accordance with Federal Law No. 402‑FZ \"On Accounting\" I demand to be provided with and sent to the address specified above the legal documents and information confirming charges and expenses for the following services:";

  const bodyList = chosenServices || (lang === "ru" ? "– перечень услуг" : "– list of services");

  const bodyPeriod = lang === "ru"
    ? `Требую предоставить расшифровку начислений за период: ${f.period || "___________"}.`
    : `I demand a breakdown of charges for the period: ${f.period || "___________"}.`;

  const bodyLegal = lang === "ru"
    ? "Требую предоставить информацию о законных основаниях взимания денежных средств и ведения деятельности по указанному адресу."
    : "I demand information on the legal grounds for collecting funds and conducting activities at the specified address.";

  const bodySend = lang === "ru"
    ? "Информацию прошу направить в письменном виде по адресу проживания и (или) на электронную почту, указанную в обращении."
    : "Please send the information in writing to my residential address and/or to the email address indicated in this request.";

  const footer = lang === "ru" ? "Дата ________\nПодпись ________" : "Date ________\nSignature ________";

  return `${header}\n\n${lang === "ru" ? "ЗАЯВЛЕНИЕ" : "APPLICATION"}\n\n${bodyIntro}\n\n${bodyList}\n\n${bodyPeriod}\n\n${bodyLegal}\n\n${bodySend}\n\n${footer}`.trim();
}

function getLetterPreview() {
  return getLetterPreviewFromData(state.constructorForm);
}

function downloadOrderPdf(order) {
  const f = order?.data || state.constructorForm;
  if (!f) return;
  try {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
      alert(state.lang === 'ru' ? 'Библиотека PDF не загружена' : 'PDF library not loaded');
      return;
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 20;

    doc.setFontSize(10);

    // Шапка справа сверху
    const headerLines = [
      state.lang === 'ru' ? 'Руководителю' : 'To the head of',
      f.ukName || '___________',
      f.ukAddress || '___________',
      '',
      (state.lang === 'ru' ? 'От ' : 'From ') + (f.fullName || '___________'),
      state.lang === 'ru' ? 'Проживающего по адресу' : 'Residing at',
      f.address || '___________',
      ...(f.emailForReply ? [(state.lang === 'ru' ? 'Тел./Email: ' : 'Tel/Email: ') + f.emailForReply] : []),
    ];
    const headerText = headerLines.join('\n');
    const headerSplit = doc.splitTextToSize(headerText, 70);
    doc.text(headerSplit, pageW - margin, y, { align: 'right' });
    y += headerSplit.length * 5 + 10;

    // ЗАЯВЛЕНИЕ по центру
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(state.lang === 'ru' ? 'ЗАЯВЛЕНИЕ' : 'APPLICATION', pageW / 2, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 12;

    // Основной текст слева
    const chosenServices = Object.entries(f.services || {})
      .filter(([, v]) => v)
      .map(([k]) => {
        switch (k) {
          case 'content': return state.lang === 'ru' ? 'содержание и ремонт жилья' : 'housing maintenance';
          case 'heating': return state.lang === 'ru' ? 'отопление' : 'heating';
          case 'water': return state.lang === 'ru' ? 'водоснабжение' : 'water supply';
          case 'repair': return state.lang === 'ru' ? 'ремонт общедомового имущества' : 'common property repair';
          default: return '';
        }
      })
      .filter(Boolean)
      .map((s) => '– ' + s)
      .join('\n');

    const intro = state.lang === 'ru'
      ? 'В соответствии с Федеральным законом № 402‑ФЗ «О бухгалтерском учёте» требую предоставить и направить мне по указанному выше адресу правоустанавливающие документы и сведения, подтверждающие начисления и расходы по следующим услугам:'
      : 'In accordance with Federal Law No. 402‑FZ "On Accounting" I demand to be provided with and sent to the address specified above the legal documents and information confirming charges and expenses for the following services:';
    const introLines = doc.splitTextToSize(intro, contentW);
    doc.text(introLines, margin, y);
    y += introLines.length * 5 + 4;

    const listText = chosenServices || (state.lang === 'ru' ? 'перечень услуг' : 'list of services');
    const listLines = doc.splitTextToSize(listText, contentW);
    doc.text(listLines, margin, y);
    y += listLines.length * 5 + 6;

    const periodText = (state.lang === 'ru'
      ? 'Требую предоставить расшифровку начислений за период: '
      : 'I demand a breakdown of charges for the period: ') + (f.period || '___________') + '.';
    const periodLines = doc.splitTextToSize(periodText, contentW);
    doc.text(periodLines, margin, y);
    y += periodLines.length * 5 + 4;

    const legalText = state.lang === 'ru'
      ? 'Требую предоставить информацию о законных основаниях взимания денежных средств и ведения деятельности по указанному адресу.'
      : 'I demand information on the legal grounds for collecting funds and conducting activities at the specified address.';
    const legalLines = doc.splitTextToSize(legalText, contentW);
    doc.text(legalLines, margin, y);
    y += legalLines.length * 5 + 4;

    const sendText = state.lang === 'ru'
      ? 'Информацию прошу направить в письменном виде по адресу проживания и (или) на электронную почту, указанную в обращении.'
      : 'Please send the information in writing to my residential address and/or to the email address indicated in this request.';
    const sendLines = doc.splitTextToSize(sendText, contentW);
    doc.text(sendLines, margin, y);
    y += sendLines.length * 5 + 12;

    // Подвал: Дата слева, Подпись справа
    doc.text(state.lang === 'ru' ? 'Дата ________' : 'Date ________', margin, y);
    doc.text(state.lang === 'ru' ? 'Подпись ________' : 'Signature ________', pageW - margin, y, { align: 'right' });

    const name = (f.ukName || 'Zapros').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').slice(0, 30);
    doc.save(`Zayavlenie_UK_${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    alert(state.lang === 'ru' ? 'Ошибка создания PDF' : 'PDF creation error');
  }
}

function openOrderModal(order) {
  const t = I18N[state.lang].profile;
  const preview = getLetterPreviewFromData(order?.data);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3 class="modal-title">${t.orderPreview}</h3>
      <div class="modal-preview"><pre>${(preview || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>
      <div class="modal-actions">
        <button class="primary-btn" id="modal-download">${t.download || 'Скачать'}</button>
        <button class="secondary-btn" id="modal-close">${t.close || 'Закрыть'}</button>
      </div>
    </div>
  `;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px';
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
  };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#modal-close').addEventListener('click', close);
  overlay.querySelector('#modal-download').addEventListener('click', () => {
    downloadOrderPdf(order);
  });
}

function formatOrderPreview(order) {
  if (!order?.data) return '';
  const uk = order.data.ukName || (state.lang === 'ru' ? 'УК не указана' : 'MC not specified');
  const period = order.data.period || '';
  return [uk, period].filter(Boolean).join(' · ') || (state.lang === 'ru' ? 'Заказ' : 'Order');
}

function render() {
  applyLanguageToShell();
  const hash = window.location.hash;
  if (hash === "#blog" || hash.startsWith("#blog/")) {
    renderBlog();
  } else if (hash === "#profile") {
    renderProfile();
  } else if (hash === "#legal" || hash === "#legal-offer" || hash === "#legal-privacy") {
    if (hash === "#legal-offer") renderLegalPage("offer");
    else if (hash === "#legal-privacy") renderLegalPage("privacy");
    else renderLegalIndex();
  } else {
    renderHome();
  }
}

function refreshLetterPreview() {
  const pre = document.getElementById("letter-preview");
  if (!pre) return;
  pre.textContent = getLetterPreview();
}

function applyLanguageToShell() {
  const dict = I18N[state.lang];
  document.documentElement.lang = state.lang === "ru" ? "ru" : "en";

  const navLinks = document.querySelectorAll(".nav-link");
  if (navLinks.length >= 5) {
    navLinks[0].textContent = dict.nav.home;
    navLinks[1].textContent = dict.nav.service;
    navLinks[2].textContent = dict.nav.blog;
    navLinks[3].textContent = dict.nav.contacts;
    navLinks[4].textContent = dict.nav.legal;
  }

  const footerLinks = document.querySelectorAll(".footer-links .link-like");
  if (footerLinks.length >= 2) {
    footerLinks[0].textContent = dict.footer.offer;
    footerLinks[1].textContent = dict.footer.privacy;
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    const isActive = btn.getAttribute("data-lang") === state.lang;
    btn.classList.toggle("lang-btn-active", isActive);
  });
}

// ========== PAGES ==========

function renderHome() {
  const letter = getLetterPreview();
  const tHero = I18N[state.lang].hero;
  const tService = I18N[state.lang].service;
  const tForm = I18N[state.lang].constructor;
  const tContacts = I18N[state.lang].contacts;
  const tLegal = I18N[state.lang].legal;

  appRoot.innerHTML = `
    <div class="landing">
      <section id="hero" class="section hero-section">
        <div class="hero-grid">
          <div class="hero-main neo-card float-up">
            <div class="badge">
              <span class="badge-dot"></span>
              ${tHero.badge}
            </div>
            <h1 class="page-title">
              ${tHero.title}
            </h1>
            <p class="page-subtitle">
              ${tHero.subtitle}
            </p>
            <div class="pill-row">
              ${tHero.pills
                .map((pill) => `<div class="pill">${pill}</div>`)
                .join("")}
            </div>
            <div class="btn-row">
              <a href="#constructor" class="primary-btn">${tHero.ctaPrimary}</a>
              <a href="#service" class="secondary-btn">${tHero.ctaSecondary}</a>
            </div>
            <p class="tagline">
              ${tHero.tagline}
            </p>
          </div>
          <div class="hero-side neo-card float-up-delayed">
            <h2 class="section-title">${tHero.howTitle}</h2>
            <ol class="small hero-steps">
              ${tHero.howSteps
                .map((step) => `<li>${step}</li>`)
                .join("")}
            </ol>
          </div>
        </div>
      </section>

      <section id="service" class="section">
        <div class="neo-card section-shell">
          <div class="section-header">
            <h2 class="section-title">${tService.title}</h2>
            <p class="section-subtitle">
              ${tService.subtitle}
            </p>
          </div>
          <div class="cards-row">
            <div class="neo-card price-card">
            <div class="badge badge-soft">
              <span class="badge-dot"></span>
              ${tService.baseBadge}
            </div>
            <h3 class="price-title">${tService.baseTitle}</h3>
            <div class="price-main">${tService.basePrice}</div>
            <ul class="price-list small">
              ${tService.basePoints
                .map((p) => `<li>${p}</li>`)
                .join("")}
            </ul>
            <button class="primary-btn full-width" id="btn-tariff-base">
              ${tService.baseButton}
            </button>
          </div>

            <div class="neo-card price-card price-card-accent">
            <div class="badge badge-soft">
              <span class="badge-dot"></span>
              ${tService.expertBadge}
            </div>
            <h3 class="price-title">${tService.expertTitle}</h3>
            <div class="price-main">${tService.expertPrice}</div>
            <ul class="price-list small">
              ${tService.expertPoints
                .map((p) => `<li>${p}</li>`)
                .join("")}
            </ul>
            <button class="secondary-btn full-width" id="btn-tariff-expert">
              ${tService.expertButton}
            </button>
            </div>
          </div>
        </div>
      </section>

      <section id="constructor" class="section">
        <div class="neo-card section-shell">
          <div class="section-header">
            <h2 class="section-title">${tForm.title}</h2>
            <p class="section-subtitle">
              ${tForm.subtitle}
            </p>
          </div>
          <div class="constructor-grid">
          <div class="neo-card">
            <form id="constructor-form">
              <div class="field">
                <div class="stacked-label">${tForm.fullName}</div>
                <input class="input" name="fullName" value="${state.constructorForm.fullName}" placeholder="${tForm.fullNamePlaceholder}" />
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.address}</div>
                <input class="input" name="address" value="${state.constructorForm.address}" placeholder="${tForm.addressPlaceholder}" />
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.ukName}</div>
                <input class="input" name="ukName" value="${state.constructorForm.ukName}" placeholder="${tForm.ukNamePlaceholder}" />
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.ukAddress}</div>
                <input class="input" name="ukAddress" value="${state.constructorForm.ukAddress}" placeholder="${tForm.ukAddressPlaceholder}" />
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.period}</div>
                <input class="input" name="period" value="${state.constructorForm.period}" placeholder="${tForm.periodPlaceholder}" />
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.services}</div>
                <div class="checkbox-row">
                  ${renderServiceCheckbox("content", tForm.servicesOptions.content)}
                  ${renderServiceCheckbox("heating", tForm.servicesOptions.heating)}
                  ${renderServiceCheckbox("water", tForm.servicesOptions.water)}
                  ${renderServiceCheckbox("repair", tForm.servicesOptions.repair)}
                </div>
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.email}</div>
                <input class="input" name="emailForReply" value="${state.constructorForm.emailForReply}" placeholder="${tForm.emailPlaceholder}" />
              </div>
              <div class="field">
                <label class="checkbox-pill">
                  <input type="checkbox" id="with-expert" ${state.withExpert ? "checked" : ""} />
                  ${tForm.withExpert}
                </label>
              </div>
            </form>
            <div class="btn-row">
              <button class="secondary-btn" id="btn-save-draft">${tForm.saveDraft}</button>
              <button class="primary-btn" id="btn-create-order">${tForm.createOrder}</button>
            </div>
            <p class="small muted-text">
              ${tForm.hint}
            </p>
          </div>

          <div class="neo-card preview-card">
            <h3 class="preview-title">${tForm.previewTitle}</h3>
            <p class="small muted-text">
              ${tForm.previewSubtitle}
            </p>
            <div class="preview-letter">
              <pre id="letter-preview" style="white-space:pre-wrap; font-family:system-ui, sans-serif; font-size:13px; margin:6px 0 0;">${letter}</pre>
            </div>
          </div>
        </div>
      </section>

      <section id="contacts" class="section">
        <div class="neo-card section-shell">
          <div class="section-header">
            <h2 class="section-title">${tContacts.title}</h2>
            <p class="section-subtitle">
              ${tContacts.subtitle}
            </p>
          </div>
          <div class="cards-row">
            <div class="neo-card">
            <div class="field">
              <div class="stacked-label">${tContacts.supportEmail}</div>
              <div class="tag">support@konstruct.app</div>
            </div>
            <div class="field">
              <div class="stacked-label">${tContacts.telegram}</div>
              <div class="tag"><a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">@k0nstruct_bot</a></div>
            </div>
            </div>
            <div class="neo-card">
            <h3 class="price-title">${tContacts.formTitle}</h3>
            <form id="contact-form">
              <div class="field">
                <div class="stacked-label">${tContacts.nameLabel}</div>
                <input class="input" name="name" placeholder="${tContacts.namePlaceholder}" />
              </div>
              <div class="field">
                <div class="stacked-label">${tContacts.emailLabel}</div>
                <input class="input" name="email" type="email" placeholder="${tContacts.emailPlaceholder}" />
              </div>
              <div class="field">
                <div class="stacked-label">${tContacts.messageLabel}</div>
                <textarea class="textarea" name="message" placeholder="${tContacts.messagePlaceholder}"></textarea>
              </div>
              <button class="secondary-btn full-width" type="submit">${tContacts.sendButton}</button>
            </form>
            </div>
          </div>
        </div>
      </section>

    </div>
  `;

  // Обработчики конструктора — делегирование на форму для надёжной работы в TMA
  const form = document.getElementById("constructor-form");
  if (form) {
    const textFields = ["fullName", "address", "ukName", "ukAddress", "period", "emailForReply"];
    const handleInput = (e) => {
      const el = e.target;
      const name = el?.getAttribute?.("name");
      if (name && textFields.includes(name)) {
        updateConstructorField(name, el.value);
      }
    };
    const handleChange = (e) => {
      const el = e.target;
      const service = el?.getAttribute?.("data-service");
      if (service) toggleService(service);
    };
    form.addEventListener("input", handleInput);
    form.addEventListener("keyup", handleInput);
    form.addEventListener("change", (e) => {
      const el = e.target;
      const name = el?.getAttribute?.("name");
      if (name && textFields.includes(name)) {
        updateConstructorField(name, el.value);
      } else {
        handleChange(e);
      }
    });
  }

  const expertCheckbox = document.getElementById("with-expert");
  if (expertCheckbox) {
    expertCheckbox.addEventListener("change", (e) => {
      state.withExpert = e.target.checked;
      render();
    });
  }

  const btnSaveDraft = document.getElementById("btn-save-draft");
  if (btnSaveDraft) {
    btnSaveDraft.addEventListener("click", saveDraft);
  }

  const btnCreateOrder = document.getElementById("btn-create-order");
  if (btnCreateOrder) {
    btnCreateOrder.addEventListener("click", () => createOrder());
  }

  // Тарифные кнопки
  const btnBase = document.getElementById("btn-tariff-base");
  const btnExpert = document.getElementById("btn-tariff-expert");
  if (btnBase) {
    btnBase.addEventListener("click", () => {
      state.withExpert = false;
      document.getElementById("with-expert").checked = false;
      document.getElementById("constructor").scrollIntoView({
        behavior: "smooth",
      });
    });
  }
  if (btnExpert) {
    btnExpert.addEventListener("click", () => {
      state.withExpert = true;
      document.getElementById("with-expert").checked = true;
      document.getElementById("constructor").scrollIntoView({
        behavior: "smooth",
      });
    });
  }

  // Форма контактов
  const contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      alert(I18N[state.lang].contacts.sendAlert);
      contactForm.reset();
    });
  }

  // Анимация появления секций при скролле
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("section-visible");
        }
      });
    },
    { threshold: 0.2 }
  );

  document.querySelectorAll(".section").forEach((section) => {
    observer.observe(section);
  });

  function renderServiceCheckbox(key, label) {
    return `
      <label class="checkbox-pill">
        <input type="checkbox" data-service="${key}" ${
          state.constructorForm.services[key] ? "checked" : ""
        } />
        ${label}
      </label>
    `;
  }
}

// ========== PROFILE PAGE (черновики) ==========

function formatDraftPreview(d) {
  if (!d) return '';
  const uk = d.ukName || (state.lang === 'ru' ? 'УК не указана' : 'MC not specified');
  const period = d.period || '';
  return [uk, period].filter(Boolean).join(' · ') || (state.lang === 'ru' ? 'Черновик' : 'Draft');
}

function loadDraftIntoConstructor(draft) {
  if (!draft?.data) return;
  const d = draft.data;
  state.editingDraftId = draft.id;
  state.constructorForm = {
    fullName: d.fullName || '',
    address: d.address || '',
    ukName: d.ukName || '',
    ukAddress: d.ukAddress || '',
    period: d.period || '',
    emailForReply: d.emailForReply || '',
    services: d.services || { content: true, heating: false, water: false, repair: false },
  };
  state.withExpert = !!d.withExpert;
  window.location.hash = '#constructor';
  render();
}

async function deleteDraft(id) {
  if (!confirm(state.lang === 'ru' ? 'Удалить черновик?' : 'Delete draft?')) return;
  try {
    await deleteDraftFromApi(id);
    state.profileDrafts = (state.profileDrafts || []).filter((d) => d.id !== id);
    render();
  } catch (e) {
    alert(state.lang === 'ru' ? 'Ошибка удаления' : 'Delete error');
  }
}

async function renderProfile() {
  const t = I18N[state.lang].profile;
  applyLanguageToShell();

  if (!state.user) {
    appRoot.innerHTML = `
      <div class="landing">
        <section id="profile" class="section hero-section section-visible">
          <div class="neo-card section-shell">
            <h2 class="section-title">${t.title}</h2>
            <div class="profile-tabs profile-tabs-split">
              <button class="profile-tab-btn ${state.profileTab === 'drafts' ? 'active' : ''}" data-tab="drafts">${t.tabDrafts}</button>
              <button class="profile-tab-btn ${state.profileTab === 'orders' ? 'active' : ''}" data-tab="orders">${t.tabOrders}</button>
            </div>
            <div id="profile-tab-content">
              <div id="profile-drafts-list" class="profile-tab-pane" style="${state.profileTab === 'drafts' ? '' : 'display:none'}">
                <p class="section-subtitle">${t.loginHint}</p>
                <a href="#" class="primary-btn" onclick="document.getElementById('profile-btn')?.click(); return false;">${state.lang === 'ru' ? 'Войти' : 'Log in'}</a>
              </div>
              <div id="profile-orders-list" class="profile-tab-pane" style="${state.profileTab === 'orders' ? '' : 'display:none'}">
                <p class="section-subtitle">${t.loginHint}</p>
                <a href="#" class="primary-btn" onclick="document.getElementById('profile-btn')?.click(); return false;">${state.lang === 'ru' ? 'Войти' : 'Log in'}</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
    document.querySelectorAll('.profile-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === state.profileTab) return;
        state.profileTab = tab;
        document.querySelectorAll('.profile-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('profile-drafts-list').style.display = tab === 'drafts' ? '' : 'none';
        document.getElementById('profile-orders-list').style.display = tab === 'orders' ? '' : 'none';
      });
    });
    return;
  }

  const firstLetter = (state.user.first_name || state.user.username || 'U')[0].toUpperCase();
  const photoUrl = state.user.photo_url;
  const displayName = state.user.first_name || state.user.username || (state.lang === 'ru' ? 'Пользователь' : 'User');
  const username = state.user.username ? '@' + state.user.username : '';

  const hasCachedDrafts = Array.isArray(state.profileDrafts);
  state.isLoading = !hasCachedDrafts;
  appRoot.innerHTML = `
    <div class="landing">
      <section id="profile" class="section hero-section section-visible">
        <div class="neo-card section-shell">
          <div class="profile-header" style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid rgba(207,216,231,0.9)">
            <div class="profile-avatar-large" style="width:64px;height:64px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--bg-soft);position:relative">
              <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;color:var(--accent)">${firstLetter}</span>
              ${photoUrl ? `<img src="${photoUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.remove()">` : ''}
            </div>
            <div>
              <div class="profile-name" style="font-size:18px;font-weight:600;margin-bottom:4px">${displayName}</div>
              ${username ? `<div class="profile-username small muted-text">${username}</div>` : ''}
            </div>
          </div>
          <div class="profile-tabs profile-tabs-split">
            <button class="profile-tab-btn ${state.profileTab === 'drafts' ? 'active' : ''}" data-tab="drafts">${t.tabDrafts}</button>
            <button class="profile-tab-btn ${state.profileTab === 'orders' ? 'active' : ''}" data-tab="orders">${t.tabOrders}</button>
          </div>
          <div id="profile-tab-content">
            <div id="profile-drafts-list" class="profile-tab-pane profile-drafts-list" style="${state.profileTab === 'drafts' ? '' : 'display:none'}">
              ${hasCachedDrafts ? (state.profileDrafts.length === 0 ? `<p class="small muted-text">${t.empty}</p>` : '') : `<p class="small muted-text">${state.lang === 'ru' ? 'Загрузка...' : 'Loading...'}</p>`}
            </div>
            <div id="profile-orders-list" class="profile-tab-pane profile-orders-list" style="${state.profileTab === 'orders' ? '' : 'display:none'}">
              <p class="small muted-text">${t.ordersEmpty}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  if (!hasCachedDrafts) {
    try {
      const [drafts, orders] = await Promise.all([
        fetchDrafts(),
        fetchOrders().catch(() => []),
      ]);
      state.profileDrafts = drafts;
      state.profileOrders = orders || [];
    } catch (e) {
      state.profileDrafts = [];
      state.profileOrders = state.profileOrders || [];
    }
  } else if (!Array.isArray(state.profileOrders)) {
    try {
      state.profileOrders = await fetchOrders();
    } catch {
      state.profileOrders = [];
    }
  }
  state.isLoading = false;

  const ordersEl = document.getElementById('profile-orders-list');
  if (ordersEl) {
    if (state.profileOrders.length === 0) {
      ordersEl.innerHTML = `<p class="small muted-text">${t.ordersEmpty}</p>`;
    } else {
      ordersEl.innerHTML = state.profileOrders
        .map(
          (o, i) => `
        <div class="neo-card order-card" style="margin-bottom:12px;padding:14px;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;margin-bottom:4px">${formatOrderPreview(o)}</div>
            <div class="small muted-text">${t.orderStatusNoReview} · ${new Date(o.created_at).toLocaleDateString()}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="secondary-btn order-open-btn" data-order-index="${i}">${t.orderOpen}</button>
            <button class="secondary-btn order-delete-btn" data-order-id="${o.id}" style="color:var(--danger, #c33)">${t.deleteOrder}</button>
          </div>
        </div>
      `
        )
        .join('');
      ordersEl.querySelectorAll('.order-open-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-order-index'), 10);
          const o = state.profileOrders[idx];
          if (o) openOrderModal(o);
        });
      });
      ordersEl.querySelectorAll('.order-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => deleteOrder(btn.getAttribute('data-order-id')));
      });
    }
  }

async function deleteOrder(id) {
  if (!confirm(state.lang === 'ru' ? 'Удалить заказ?' : 'Delete order?')) return;
  try {
    await deleteOrderFromApi(id);
    state.profileOrders = (state.profileOrders || []).filter((o) => o.id !== id);
    render();
  } catch (e) {
    alert(state.lang === 'ru' ? 'Ошибка удаления' : 'Delete error');
  }
}

  const listEl = document.getElementById('profile-drafts-list');
  if (listEl) {
    if (state.profileDrafts.length === 0) {
      listEl.innerHTML = `<p class="small muted-text">${t.empty}</p>`;
    } else {
      listEl.innerHTML = state.profileDrafts
        .map(
          (d, i) => `
        <div class="neo-card draft-card" style="margin-bottom:12px;padding:14px;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div class="draft-preview" style="flex:1;min-width:0">
            <div class="draft-title" style="font-weight:600;margin-bottom:4px">${formatDraftPreview(d.data)}</div>
            <div class="small muted-text">${new Date(d.updated_at || d.created_at).toLocaleDateString()}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="secondary-btn draft-load-btn" data-draft-index="${i}">${t.loadDraft}</button>
            <button class="secondary-btn draft-delete-btn" data-draft-id="${d.id}" style="color:var(--danger, #c33)">${t.deleteDraft}</button>
          </div>
        </div>
      `
        )
        .join('');
      listEl.querySelectorAll('.draft-load-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-draft-index'), 10);
          const d = state.profileDrafts[idx];
          if (d) loadDraftIntoConstructor(d);
        });
      });
      listEl.querySelectorAll('.draft-delete-btn').forEach((btn) => {
        btn.addEventListener('click', () => deleteDraft(btn.getAttribute('data-draft-id')));
      });
    }
  }

  document.querySelectorAll('.profile-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (tab === state.profileTab) return;
      state.profileTab = tab;
      const draftsEl = document.getElementById('profile-drafts-list');
      const ordersEl = document.getElementById('profile-orders-list');
      document.querySelectorAll('.profile-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (tab === 'drafts') {
        if (draftsEl) draftsEl.style.display = '';
        if (ordersEl) ordersEl.style.display = 'none';
      } else {
        if (draftsEl) draftsEl.style.display = 'none';
        if (ordersEl) ordersEl.style.display = '';
      }
    });
  });
}

// ========== LEGAL PAGES (оферта, политика) ==========

function renderLegalIndex() {
  const t = I18N[state.lang].legal;
  const lang = state.lang;
  appRoot.innerHTML = `
    <div class="landing legal-page">
      <section class="section section-visible">
        <div class="neo-card">
          <a href="#" class="back-link">&larr; ${t.backLink}</a>
          <h1 class="page-title">${lang === "ru" ? "Документы" : "Legal"}</h1>
          <p class="section-subtitle">${lang === "ru" ? "Выберите документ" : "Choose a document"}.</p>
          <div class="legal-links" style="display:flex;flex-direction:column;gap:12px;margin-top:16px">
            <a href="#legal-offer" class="primary-btn" style="text-align:center;text-decoration:none">${t.offerTitle}</a>
            <a href="#legal-privacy" class="secondary-btn" style="text-align:center;text-decoration:none">${t.privacyTitle}</a>
          </div>
        </div>
      </section>
    </div>
  `;
  document.querySelector(".back-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.hash = "";
    render();
  });
}

function renderLegalPage(type) {
  const t = I18N[state.lang].legal;
  const lang = state.lang;
  const isOffer = type === "offer";
  const title = isOffer ? t.offerTitle : t.privacyTitle;
  const content = isOffer ? t.offerPage : t.privacyPage;

  appRoot.innerHTML = `
    <div class="landing legal-page">
      <section class="section section-visible">
        <div class="neo-card">
          <a href="#" class="back-link">&larr; ${t.backLink}</a>
          <h1 class="page-title">${title}</h1>
          <div class="legal-content legal-page-content">
            ${content}
          </div>
        </div>
      </section>
    </div>
  `;

  document.querySelector(".back-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.hash = "";
    render();
  });
}

// ========== BLOG PAGE ==========

function renderBlog() {
  const tBlog = I18N[state.lang].blog;
  const lang = state.lang;

  const posts = state.blogPosts.length > 0 ? state.blogPosts : getDemoBlogPosts();

  const postsHTML = posts
    .map(
      (post) => `
    <article class="neo-card blog-post">
      <div class="blog-post-header">
        <h2 class="blog-post-title">${post.title[lang] || post.title}</h2>
        <span class="blog-post-date">${post.date}</span>
      </div>
      <p class="blog-post-body">${post.body[lang] || post.body}</p>
      
      <div class="blog-comments-section">
        <h3 class="comments-title">${tBlog.commentsTitle} (${post.comments.length})</h3>
        <div class="comments-list">
          ${
            post.comments.length === 0
              ? `<p class="small muted-text">${tBlog.commentsEmpty}</p>`
              : post.comments
                  .map(
                    (c) => `
              <div class="comment">
                <div class="comment-author">${c.author}</div>
                <div class="comment-body">${c.text}</div>
              </div>
            `
                  )
                  .join("")
          }
        </div>
        <div class="divider"></div>
        <div class="field">
          <div class="stacked-label">${tBlog.commentsLabel}</div>
          <textarea class="textarea comment-input" data-post-id="${post.id}" placeholder="${tBlog.commentsPlaceholder}"></textarea>
        </div>
        <button class="primary-btn btn-add-comment" data-post-id="${post.id}">${tBlog.commentsButton}</button>
      </div>
    </article>
  `
    )
    .join("");

  appRoot.innerHTML = `
    <div class="landing blog-page">
      <section class="section blog-hero-section">
        <div class="neo-card">
          <a href="#" class="back-link">&larr; ${lang === "ru" ? "На главную" : "Back to Home"}</a>
          <h1 class="page-title">${tBlog.title}</h1>
          <p class="section-subtitle">${tBlog.subtitle}</p>
        </div>
      </section>
      
      <section class="section blog-posts-section">
        ${postsHTML}
      </section>
    </div>
  `;

  document.querySelectorAll(".btn-add-comment").forEach((btn) => {
    btn.addEventListener("click", () => {
      const postId = btn.getAttribute("data-post-id");
      const textarea = document.querySelector(`.comment-input[data-post-id="${postId}"]`);
      if (textarea && textarea.value.trim()) {
        addComment(postId, textarea.value);
      }
    });
  });

  document.querySelector(".back-link")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.hash = "";
    render();
  });
}

// ========== PROFILE UI ==========

function updateProfileUI() {
  const avatarEl = document.getElementById('profile-avatar');
  const contentEl = document.getElementById('profile-content');
  
  if (!avatarEl || !contentEl) return;
  
  if (state.user) {
    const firstLetter = (state.user.first_name || state.user.username || 'U')[0].toUpperCase();
    const photoUrl = state.user.photo_url;
    
    if (photoUrl) {
      avatarEl.innerHTML = `<img src="${photoUrl}" alt="avatar" onerror="this.outerHTML='<span class=\\'profile-avatar-letter\\'>${firstLetter}</span>'">`;
    } else {
      avatarEl.innerHTML = `<span class="profile-avatar-letter">${firstLetter}</span>`;
    }
    
    contentEl.innerHTML = `
      <div class="profile-info">
        <div class="profile-info-avatar">
          ${photoUrl ? `<img src="${photoUrl}" alt="" onerror="this.outerHTML='${firstLetter}'">` : firstLetter}
        </div>
        <div class="profile-info-text">
          <div class="profile-info-name">${state.user.first_name || 'Пользователь'}</div>
          ${state.user.username ? `<div class="profile-info-username">@${state.user.username}</div>` : ''}
        </div>
      </div>
      <button class="profile-menu-item" onclick="goToDashboard()">${state.lang === 'ru' ? 'Профиль' : 'Profile'}</button>
      <button class="profile-menu-item logout" onclick="logout()">${state.lang === 'ru' ? 'Выйти' : 'Logout'}</button>
    `;
  } else {
    avatarEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    `;
    contentEl.innerHTML = `
      <div id="auth-by-code">
        <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 12px; text-align: center;">
          ${state.lang === 'ru' ? 'Отправь /login боту @k0nstruct_bot, введи код:' : 'Send /login to @k0nstruct_bot, enter code:'}
        </p>
        <input type="text" id="login-code-input" class="input" placeholder="XXXX" maxlength="8" style="margin-bottom:8px; text-align:center; letter-spacing:4px" />
        <button class="primary-btn full-width" id="login-code-btn">${state.lang === 'ru' ? 'Войти' : 'Log in'}</button>
      </div>
    `;
    const input = document.getElementById('login-code-input');
    const btn = document.getElementById('login-code-btn');
    if (input && btn) {
      const doLogin = () => {
        const code = input.value.trim();
        if (!code) return;
        btn.disabled = true;
        loginByCode(code).catch((e) => {
          alert(state.lang === 'ru' ? 'Код неверный или истёк' : 'Invalid or expired code');
          btn.disabled = false;
        });
      };
      btn.addEventListener('click', doLogin);
      input.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
    }
  }
}

function prefetchProfileData() {
  if (state.user && !state.profileDraftsLoading) {
    state.profileDraftsLoading = true;
    Promise.all([fetchDrafts(), fetchOrders().catch(() => [])])
      .then(([drafts, orders]) => {
        state.profileDrafts = drafts;
        state.profileOrders = orders || [];
        state.profileDraftsLoading = false;
      })
      .catch(() => { state.profileDraftsLoading = false; });
  }
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) {
    const willOpen = !dropdown.classList.contains('open');
    dropdown.classList.toggle('open');
    if (willOpen) prefetchProfileData();
  }
}

function closeProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) {
    dropdown.classList.remove('open');
  }
}

function goToDashboard() {
  closeProfileDropdown();
  prefetchProfileData();
  window.location.hash = '#profile';
  render();
}

function initProfile() {
  const profileBtn = document.getElementById('profile-btn');
  
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown();
    });
  }
  
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profile-dropdown');
    const btn = document.getElementById('profile-btn');
    if (dropdown && !dropdown.contains(e.target) && e.target !== btn) {
      closeProfileDropdown();
    }
  });
  
  updateProfileUI();
}

// ========== INIT ==========

function initShell() {
  const nav = document.querySelector(".nav");
  const navToggle = document.querySelector(".nav-toggle");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      nav.classList.toggle("nav-open");
      navToggle.classList.toggle("nav-open-toggle");
    });
  }

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (nav && nav.classList.contains("nav-open")) {
        nav.classList.remove("nav-open");
        navToggle && navToggle.classList.remove("nav-open-toggle");
      }

      const href = link.getAttribute("href");
      const currentHash = window.location.hash;
      const isOnBlogPage = currentHash === "#blog" || currentHash.startsWith("#blog/");

      if (isOnBlogPage && href !== "#blog") {
        e.preventDefault();
        window.location.hash = href;
        setTimeout(() => {
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ behavior: "smooth" });
          }
        }, 50);
      }
    });
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang");
      if (!lang || lang === state.lang) return;
      state.lang = lang;
      render();
    });
  });

  window.addEventListener("hashchange", () => render());

  state.blogPosts = getDemoBlogPosts();
  initProfile();

  initAuth().then(() => render());
}

initShell();
