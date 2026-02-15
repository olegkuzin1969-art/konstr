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
    passportSeries: "",
    passportNumber: "",
    passportIssued: "",
    phone: "",
    ukName: "",
    ukAddress: "",
    period: "",
    emailForReply: "",
    extraInfo: "",
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
  editingOrderId: null,
  isAdmin: false,
  adminOrders: [],
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

function getTmaPhotoUrl() {
  try {
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    return (u && (u.photo_url || u.photoUrl)) ? (u.photo_url || u.photoUrl) : null;
  } catch {
    return null;
  }
}

async function tryTmaLogin() {
  if (!isInTelegramWebApp()) return false;
  const initData = window.Telegram.WebApp.initData;
  if (!initData) return false;
  try {
    const { user } = await authViaTelegram('tma', { initData });
    let photoUrl = user.photo_url;
    if (!photoUrl) {
      const tmaPhoto = getTmaPhotoUrl();
      if (tmaPhoto) photoUrl = tmaPhoto;
    }
    state.user = { ...user, photo_url: photoUrl };
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
  await checkAdminStatus();
  updateAdminNav();
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
      if (isInTelegramWebApp() && !state.user?.photo_url) {
        const tmaPhoto = getTmaPhotoUrl();
        if (tmaPhoto) {
          state.user = { ...state.user, photo_url: tmaPhoto };
          localStorage.setItem('user', JSON.stringify(state.user));
        }
      }
    } catch {}
  }
  const tok = localStorage.getItem('drafts_token');
  if (tok) state.token = tok;
}

async function initAuth() {
  checkSavedAuth();
  if (state.user) {
    updateProfileUI();
    await checkAdminStatus();
    updateAdminNav();
    return;
  }
  if (await tryTmaLogin()) {
    updateProfileUI();
    await checkAdminStatus();
    updateAdminNav();
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

async function updateOrderInApi(id, orderData) {
  const data = await ordersApi('PUT', { id, data: orderData });
  return data.order;
}

async function adminOrdersApi(method, body = {}) {
  const headers = { 'Content-Type': 'application/json' };
  let url = API_BASE + '/api/admin-orders';
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

async function fetchAdminOrders() {
  const data = await adminOrdersApi('GET');
  return data.orders || [];
}

async function patchAdminOrderStatus(id, approved, revision_comment) {
  const data = await adminOrdersApi('PATCH', { id, approved, revision_comment });
  return data.order;
}

async function checkAdminStatus() {
  try {
    await adminOrdersApi('GET');
    state.isAdmin = true;
  } catch {
    state.isAdmin = false;
  }
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

// ========== BLOG (API) ==========

const API_BASE_BLOG = '';

async function fetchBlogPosts() {
  const res = await fetch(API_BASE_BLOG + '/api/blog');
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  state.blogPosts = data.posts || [];
  return state.blogPosts;
}

async function fetchBlogComments(postId) {
  const res = await fetch(API_BASE_BLOG + '/api/blog?postId=' + encodeURIComponent(postId));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.comments || [];
}

async function addBlogComment(postId, text) {
  const payload = { postId, text: String(text || '').trim() };
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) payload.initData = window.Telegram.WebApp.initData;
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(API_BASE_BLOG + '/api/blog', { method: 'POST', headers, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.comment;
}

async function createBlogPost(payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) payload.initData = window.Telegram.WebApp.initData;
  const res = await fetch(API_BASE_BLOG + '/api/blog', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.post;
}

async function updateBlogPost(id, payload) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) payload.initData = window.Telegram.WebApp.initData;
  payload.id = id;
  const res = await fetch(API_BASE_BLOG + '/api/blog', { method: 'PUT', headers, body: JSON.stringify(payload) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data.post;
}

async function deleteBlogPost(id) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(API_BASE_BLOG + '/api/blog?id=' + encodeURIComponent(id), { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

const BLOG_IMAGE_MAX_WIDTH = 1200;
const BLOG_IMAGE_QUALITY = 0.82;

function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width;
      let h = img.height;
      if (w <= BLOG_IMAGE_MAX_WIDTH && h <= BLOG_IMAGE_MAX_WIDTH) { resolve(file); return; }
      if (w > h) { h = Math.round(h * BLOG_IMAGE_MAX_WIDTH / w); w = BLOG_IMAGE_MAX_WIDTH; } else { w = Math.round(w * BLOG_IMAGE_MAX_WIDTH / h); h = BLOG_IMAGE_MAX_WIDTH; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        else resolve(file);
      }, 'image/jpeg', BLOG_IMAGE_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function uploadBlogMedia(file) {
  const isImage = file.type.startsWith('image/');
  const toUpload = isImage ? await resizeImageFile(file) : file;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const payload = { file: base64, filename: toUpload.name, type: toUpload.type.startsWith('video/') ? 'video' : 'photo' };
      if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) payload.initData = window.Telegram.WebApp.initData;
      const headers = { 'Content-Type': 'application/json' };
      if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
      try {
        const res = await fetch(API_BASE_BLOG + '/api/blog-upload', { method: 'POST', headers, body: JSON.stringify(payload) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
        resolve({ type: data.type || 'photo', url: data.url });
      } catch (e) { reject(e); }
    };
    reader.readAsDataURL(toUpload);
  });
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
      fullName: "ФИО полностью",
      fullNamePlaceholder: "Иванов Иван Иванович",
      address: "Адрес регистрации и фактического проживания",
      addressPlaceholder: "Индекс, город, улица, дом, кв.",
      passportSeries: "Паспорт: серия",
      passportNumber: "Номер",
      passportIssued: "Выдан",
      passportIssuedPlaceholder: "кем и когда выдан",
      phone: "Контактный телефон",
      phonePlaceholder: "+7 (___) ___-__-__",
      ukName: "Кому (название УК / ФИО директора)",
      ukNamePlaceholder: "ООО «УК Пример» или ФИО руководителя",
      ukAddress: "Адрес УК",
      ukAddressPlaceholder: "г. Москва, ул. Управляющая, д. 10",
      period: "Период начислений",
      periodPlaceholder: "Например: с 01.01.2025 по 31.03.2025",
      services: "Услуги (отметьте нужные для п. 2)",
      servicesOptions: {
        content: "Содержание и коммунальные услуги",
        heating: "Отопление",
        water: "Водоснабжение",
        repair: "Ремонт общедомового имущества",
      },
      email: "Email для ответа",
      emailPlaceholder: "example@mail.ru",
      extraInfo: "Иная информация (необязательно)",
      extraInfoPlaceholder: "Например: сведения о посеве газона, ремонте детской площадки",
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
      createPost: "Создать пост",
      titleRu: "Заголовок (RU)",
      titleEn: "Заголовок (EN)",
      bodyRu: "Текст (RU)",
      bodyEn: "Текст (EN)",
      addPhoto: "Фото",
      addVideo: "Видео",
      orPasteUrl: "или вставьте URL",
      publish: "Опубликовать",
      postCreated: "Пост опубликован",
      backLink: "На главную",
      noPosts: "Пока нет постов.",
      commentsTitle: "Комментарии",
      commentsEmpty: "Пока нет комментариев.",
      commentPlaceholder: "Написать комментарий...",
      commentButton: "Отправить",
      loginToComment: "Войдите, чтобы комментировать",
      editPost: "Редактировать",
      deletePost: "Удалить",
      confirmDelete: "Удалить этот пост?",
      postUpdated: "Пост сохранён",
      postDeleted: "Пост удалён",
    },
    contacts: {
      title: "Контакты",
      subtitle:
        "В демо‑версии контактные данные условные. В продакшене здесь появятся актуальные реквизиты и ссылки на соцсети.",
      supportEmail: "Email поддержки",
      telegram: "Telegram",
      formTitle: "Форма обратной связи",
      nameLabel: "Имя",
      namePlaceholder: "Как к вам обращаться",
      emailLabel: "Email",
      emailPlaceholder: "you@example.com",
      messageLabel: "Сообщение",
      messagePlaceholder: "Кратко опишите вопрос или запрос",
      sendButton: "Отправить",
      sendSuccess: "Сообщение отправлено. Спасибо за обратную связь!",
      sendError: "Ошибка отправки. Попробуйте позже.",
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
<p>Возврат оплаты возможен до момента предоставления готового Документа при наличии технической возможности. Запрос направляется на <a href="mailto:practsuveren@yandex.ru">practsuveren@yandex.ru</a> или в Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

<h2>8. Ответственность</h2>
<p>Исполнитель не несёт ответственности за использование Пользователем сформированного Документа и за действия УК. Сервис предоставляет типовой шаблон запроса; итоговое решение о направлении запроса принимает Пользователь.</p>

<h2>9. Контакты</h2>
<p>По вопросам оферты и услуг: <a href="mailto:practsuveren@yandex.ru">practsuveren@yandex.ru</a>, Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>
`,
      privacyPage: `
<h2>1. Общие сведения</h2>
<p>Настоящая Политика конфиденциальности (далее — Политика) определяет порядок обработки и защиты персональных данных пользователей сервиса «Конструкт» (далее — Сервис, мы).</p>
<p>Сервис соблюдает требования Федерального закона № 152-ФЗ «О персональных данных» и обеспечивает конфиденциальность и защиту персональных данных.</p>

<h2>2. Оператор персональных данных</h2>
<p>Оператором персональных данных является владелец сервиса «Конструкт». Контактная информация: <a href="mailto:practsuveren@yandex.ru">practsuveren@yandex.ru</a>, <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

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
<p>Обращения направляйте на <a href="mailto:practsuveren@yandex.ru">practsuveren@yandex.ru</a> или в Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

<h2>9. Cookies и технологии</h2>
<p>Сервис использует локальное хранилище браузера (localStorage) для сохранения сессии, настроек и черновиков. Это необходимо для работы личного кабинета и конструктора.</p>

<h2>10. Изменения Политики</h2>
<p>Мы вправе вносить изменения в настоящую Политику. Актуальная версия всегда доступна на данной странице.</p>
`,
    },
    admin: {
      title: "Админ-панель",
      subtitle: "Все заказы пользователей. Меняйте статус: готов (можно скачать) или на доработку (с комментарием).",
      empty: "Нет заказов.",
      statusInWork: "В работе",
      statusReady: "Готов",
      statusRevision: "На доработку",
      setReady: "Завершить (можно скачать)",
      setRevision: "На доработку",
      commentPlaceholder: "Комментарий эксперта...",
      save: "Сохранить",
      user: "Пользователь",
      date: "Дата",
      view: "Просмотр",
    },
    profile: {
      title: "Профиль",
      tabDrafts: "Черновики",
      tabOrders: "Заказы",
      subtitle: "Сохранённые запросы в УК. Нажмите, чтобы продолжить редактирование.",
      empty: "Нет сохранённых черновиков.",
      ordersEmpty: "Нет заказов.",
      orderStatusNoReview: "Без проверки",
      orderStatusInReview: "В работе",
      orderStatusReady: "Готов",
      orderStatusRevision: "Доработать",
      orderInReviewHint: "Документ на проверке у эксперта. Скачать можно будет после одобрения.",
      orderRevisionHint: "Эксперт внёс замечания. Перейдите к доработке.",
      gotoRevision: "Перейти к доработке",
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
      address: "Registration and actual residence address",
      addressPlaceholder: "Postcode, city, street, building, apt.",
      passportSeries: "Passport: series",
      passportNumber: "Number",
      passportIssued: "Issued by",
      passportIssuedPlaceholder: "authority and date",
      phone: "Contact phone",
      phonePlaceholder: "+7 (___) ___-__-__",
      ukName: "To (MC name / director name)",
      ukNamePlaceholder: "LLC \"Example MC\" or director full name",
      ukAddress: "MC address",
      ukAddressPlaceholder: "Moscow, Management st. 10",
      period: "Billing period",
      periodPlaceholder: "e.g. 01.01.2025 – 31.03.2025",
      services: "Services (for section 2)",
      servicesOptions: {
        content: "Housing and communal services",
        heating: "Heating",
        water: "Water supply",
        repair: "Common property repairs",
      },
      email: "Email for reply",
      emailPlaceholder: "example@mail.com",
      extraInfo: "Other information (optional)",
      extraInfoPlaceholder: "e.g. lawn, playground repair",
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
      createPost: "Create post",
      titleRu: "Title (RU)",
      titleEn: "Title (EN)",
      bodyRu: "Text (RU)",
      bodyEn: "Text (EN)",
      addPhoto: "Photo",
      addVideo: "Video",
      orPasteUrl: "or paste URL",
      publish: "Publish",
      postCreated: "Post published",
      backLink: "Back to Home",
      noPosts: "No posts yet.",
      commentsTitle: "Comments",
      commentsEmpty: "No comments yet.",
      commentPlaceholder: "Write a comment...",
      commentButton: "Send",
      loginToComment: "Log in to comment",
      editPost: "Edit",
      deletePost: "Delete",
      confirmDelete: "Delete this post?",
      postUpdated: "Post saved",
      postDeleted: "Post deleted",
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
      sendButton: "Send",
      sendSuccess: "Message sent. Thank you!",
      sendError: "Send failed. Please try again later.",
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
<p><a href="mailto:practsuveren@yandex.ru">practsuveren@yandex.ru</a>, Telegram: <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>
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
<p>You may request access, correction, or deletion of your data. Contact: <a href="mailto:practsuveren@yandex.ru">practsuveren@yandex.ru</a> or <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener">@k0nstruct_bot</a>.</p>

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
    admin: {
      title: "Admin Panel",
      subtitle: "All user orders. Change status: ready (can download) or revision (with comment).",
      empty: "No orders.",
      statusInWork: "In progress",
      statusReady: "Ready",
      statusRevision: "Revision",
      setReady: "Complete (can download)",
      setRevision: "Send for revision",
      commentPlaceholder: "Expert comment...",
      save: "Save",
      user: "User",
      date: "Date",
      view: "View",
    },
    profile: {
      title: "Profile",
      tabDrafts: "Drafts",
      tabOrders: "Orders",
      subtitle: "Saved requests to MC. Click to continue editing.",
      empty: "No saved drafts.",
      ordersEmpty: "No orders.",
      orderStatusNoReview: "Without review",
      orderStatusInReview: "In progress",
      orderStatusReady: "Ready",
      orderStatusRevision: "Needs revision",
      orderInReviewHint: "Document is under expert review. You can download it after approval.",
      orderRevisionHint: "Expert left comments. Proceed to revision.",
      gotoRevision: "Go to revision",
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
    passportSeries: "",
    passportNumber: "",
    passportIssued: "",
    phone: "",
    ukName: "",
    ukAddress: "",
    period: "",
    emailForReply: "",
    extraInfo: "",
    services: { content: true, heating: false, water: false, repair: false },
  };
  state.withExpert = false;
  state.editingDraftId = null;
  state.editingOrderId = null;
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
  const orderData = { ...state.constructorForm, withExpert: state.withExpert };
  try {
    if (state.editingOrderId) {
      const updated = await updateOrderInApi(state.editingOrderId, orderData);
      clearConstructorForm();
      state.profileOrders = (state.profileOrders || []).map((o) =>
        o.id === state.editingOrderId ? { ...o, ...updated } : o
      );
      alert(state.lang === 'ru' ? 'Заказ обновлён и направлен на повторную проверку.' : 'Order updated and sent for re-review.');
    } else {
      const created = await createOrderApi(orderData);
      clearConstructorForm();
      state.profileOrders = [{ ...created }, ...(state.profileOrders || [])];
      alert(state.withExpert
        ? (state.lang === 'ru' ? 'Заказ оформлен. Документ направлен на проверку эксперту. Вы сможете скачать его после одобрения.' : 'Order created. Document sent for expert review. You can download it after approval.')
        : (state.lang === 'ru' ? 'Заказ оформлен' : 'Order created'));
    }
    window.location.hash = '#profile';
    render();
  } catch (e) {
    alert(state.lang === 'ru' ? 'Ошибка: ' + (e.message || 'Проверьте подключение') : 'Error: ' + (e.message || 'Check connection'));
  }
}

function getRequestDocParts(f, lang) {
  const ru = lang === "ru";
  const chosenServices = Object.entries(f.services || {})
    .filter(([, v]) => v)
    .map(([k]) => {
      switch (k) {
        case "content": return ru ? "содержание и ремонт жилья" : "housing maintenance";
        case "heating": return ru ? "отопление" : "heating";
        case "water": return ru ? "водоснабжение" : "water supply";
        case "repair": return ru ? "ремонт общедомового имущества" : "common property repair";
        default: return "";
      }
    })
    .filter(Boolean);
  const periodPhrase = f.period
    ? (ru ? " за период " : " for period ") + f.period
    : (ru ? " за последние 12 месяцев" : " for the last 12 months");
  const periodPhrase11 = f.period ? (ru ? " За период " : " For period ") + f.period + "." : "";
  const servicesList = chosenServices.length
    ? (ru ? "Информацию о расходах на услуги: " : "Information on expenses for services: ") + chosenServices.join(", ") + "."
    : (ru ? "Информацию о выполненных работах и оказанных услугах по содержанию и ремонту общего имущества за последние 12 месяцев, включая стоимость и объемы (в соответствии с договором управления)." : "Information on works and services for common property over the last 12 months.");
  return { chosenServices, periodPhrase, periodPhrase11, servicesList, ru };
}

function getLetterPreviewFromData(f) {
  if (!f) f = state.constructorForm;
  const lang = state.lang;
  const { periodPhrase, periodPhrase11, servicesList, ru } = getRequestDocParts(f, lang);

  const title = ru
    ? "ЗАПРОС о предоставлении информации, связанной с управлением многоквартирным домом (во исполнение ст. 165 ЖК РФ и Постановления Правительства РФ № 416)"
    : "REQUEST for information related to management of a multi-apartment building (pursuant to Art. 165 Housing Code and RF Government Decree No. 416)";

  const header = ru
    ? `Кому: ${f.ukName || "___________"}\nОт кого: ${f.fullName || "___________"}\nПаспорт: серия ${f.passportSeries || "____"} номер ${f.passportNumber || "______"}, выдан ${f.passportIssued || "___________"}\nАдрес регистрации и фактического проживания: ${f.address || "___________"}\nКонтактный телефон: ${f.phone || "___________"}  Email: ${f.emailForReply || "___________"}`
    : `To: ${f.ukName || "___________"}\nFrom: ${f.fullName || "___________"}\nPassport: series ${f.passportSeries || "____"} no. ${f.passportNumber || "______"}, issued ${f.passportIssued || "___________"}\nAddress: ${f.address || "___________"}\nPhone: ${f.phone || "___________"}  Email: ${f.emailForReply || "___________"}`;

  const extraText = (f.extraInfo && String(f.extraInfo).trim()) || '';
  const extraBlock = extraText ? (ru ? `\n\n5. Иная информация: ${extraText}.\n\n` : ` 5) Other: ${extraText}. `) : (ru ? '\n\n' : ' ');
  const body = ru
    ? `Я, ${f.fullName || "___________"}, являюсь собственником/нанимателем жилого помещения по вышеуказанному адресу. На основании статьи 165 Жилищного кодекса РФ и п. 31, 34-38 Постановления Правительства РФ № 416 от 15.05.2013 "О порядке осуществления деятельности по управлению многоквартирными домами", ПРОШУ:\n\nПредоставить мне в срок, установленный законодательством (не более 10 рабочих дней / 20 календарных дней согласно п. 67 Стандартов раскрытия информации), следующую информацию по моему многоквартирному дому:\n\n1. Сведения о начислениях и задолженности:\n1.1. Имеется ли у меня задолженность по оплате жилищно-коммунальных услуг на дату составления ответа? Если да — с детализацией по видам услуг и периодам.${periodPhrase11}\n1.2. Помесячные объемы потребленных коммунальных ресурсов по показаниям общедомовых приборов учета${periodPhrase}.\n\n2. Сведения о расходовании средств:\n${servicesList}\nСведения о заключенных договорах с подрядными организациями на выполнение работ (с указанием предмета договора и стоимости), если такие работы оплачивались за счет средств собственников.\n\n3. Сведения об управляющей организации: Режим работы, контактные телефоны аварийно-диспетчерской службы.\n\n4. Сведения о тарифах и нормативах: Действующие тарифы на коммунальные услуги и размер платы за содержание жилого помещения с расшифровкой (ставки за управление, содержание, текущий ремонт).${extraBlock}Дата: «»______ 20   г.\nПодпись: _______________ (${fullNameToShort(f.fullName) || '__________'})`
    : `I, ${f.fullName || "___________"}, am the owner/tenant of the residential premises at the above address. Under Art. 165 of the Housing Code of the RF and paras. 31, 34-38 of RF Government Decree No. 416 of 15.05.2013, I REQUEST:\n\nTo be provided within the statutory time limit with the following information. 1) Charges and arrears${periodPhrase11} 1.2) Monthly consumption${periodPhrase}. 2) Expenditure: ${servicesList} 3) MC details and emergency contacts. 4) Tariffs.${extraBlock}\n\nDate ________  Signature ________ (${fullNameToShort(f.fullName) || '__________'})`;

  return `${header}\n\n\n${title}\n\n\n${body}`.trim();
}

function getLetterPreview() {
  return getLetterPreviewFromData(state.constructorForm);
}

function escapeHtml(s) {
  if (s == null || s === '') return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function fullNameToShort(fullName) {
  const s = (fullName || '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return parts[0] + ' ' + (parts[1][0] || '') + '.' + (parts[2][0] || '') + '.';
  if (parts.length === 2) return parts[0] + ' ' + (parts[1][0] || '') + '.';
  return parts[0] || '';
}

function buildPdfDocumentHtml(f, ru) {
  const { periodPhrase, periodPhrase11, servicesList } = getRequestDocParts(f, ru ? 'ru' : 'en');

  const headerBlock = ru
    ? `<p style="margin:0 0 6px;"><strong>Кому:</strong> ${escapeHtml(f.ukName || '___________')}</p>
<p style="margin:0 0 6px;"><strong>От кого:</strong> ${escapeHtml(f.fullName || '___________')}</p>
<p style="margin:0 0 6px;"><strong>Паспорт:</strong> серия ${escapeHtml(f.passportSeries || '____')} номер ${escapeHtml(f.passportNumber || '______')}, выдан ${escapeHtml(f.passportIssued || '___________')}</p>
<p style="margin:0 0 6px;"><strong>Адрес регистрации и фактического проживания:</strong> ${escapeHtml(f.address || '___________')}</p>
<p style="margin:0 0 0;"><strong>Контактный телефон:</strong> ${escapeHtml(f.phone || '___________')}  <strong>Email:</strong> ${escapeHtml(f.emailForReply || '___________')}</p>`
    : `<p style="margin:0 0 6px;"><strong>To:</strong> ${escapeHtml(f.ukName || '___________')}</p>
<p style="margin:0 0 6px;"><strong>From:</strong> ${escapeHtml(f.fullName || '___________')}</p>
<p style="margin:0 0 6px;"><strong>Passport:</strong> series ${escapeHtml(f.passportSeries || '____')} no. ${escapeHtml(f.passportNumber || '______')}, issued ${escapeHtml(f.passportIssued || '___________')}</p>
<p style="margin:0 0 6px;"><strong>Address:</strong> ${escapeHtml(f.address || '___________')}</p>
<p style="margin:0 0 0;"><strong>Phone:</strong> ${escapeHtml(f.phone || '___________')}  <strong>Email:</strong> ${escapeHtml(f.emailForReply || '___________')}</p>`;

  const bodyContent = ru
    ? `<p style="margin:0 0 14px; line-height:1.5;">Я, ${escapeHtml(f.fullName || '___________')}, являюсь собственником/нанимателем жилого помещения по вышеуказанному адресу. На основании статьи 165 Жилищного кодекса РФ и п. 31, 34-38 Постановления Правительства РФ № 416 от 15.05.2013 "О порядке осуществления деятельности по управлению многоквартирными домами", ПРОШУ:</p>
<p style="margin:0 0 20px; line-height:1.5;">Предоставить мне в срок, установленный законодательством (не более 10 рабочих дней / 20 календарных дней согласно п. 67 Стандартов раскрытия информации), следующую информацию по моему многоквартирному дому:</p>
<p style="margin:0 0 8px; line-height:1.5;"><strong>1. Сведения о начислениях и задолженности:</strong></p>
<p style="margin:0 0 8px; line-height:1.5;">1.1. Имеется ли у меня задолженность по оплате жилищно-коммунальных услуг на дату составления ответа? Если да — с детализацией по видам услуг и периодам.${periodPhrase11 ? ' ' + periodPhrase11 : ''}</p>
<p style="margin:0 0 16px; line-height:1.5;">1.2. Помесячные объемы потребленных коммунальных ресурсов по показаниям общедомовых приборов учета${periodPhrase}.</p>
<p style="margin:0 0 8px; line-height:1.5;"><strong>2. Сведения о расходовании средств:</strong></p>
<p style="margin:0 0 8px; line-height:1.5;">${servicesList}</p>
<p style="margin:0 0 16px; line-height:1.5;">Сведения о заключенных договорах с подрядными организациями на выполнение работ (с указанием предмета договора и стоимости), если такие работы оплачивались за счет средств собственников.</p>
<p style="margin:0 0 8px; line-height:1.5;"><strong>3. Сведения об управляющей организации:</strong> Режим работы, контактные телефоны аварийно-диспетчерской службы.</p>
<p style="margin:0 0 8px; line-height:1.5;"><strong>4. Сведения о тарифах и нормативах:</strong> Действующие тарифы на коммунальные услуги и размер платы за содержание жилого помещения с расшифровкой (ставки за управление, содержание, текущий ремонт).</p>
${(f.extraInfo && String(f.extraInfo).trim()) ? `<p style="margin:0 0 16px; line-height:1.5;"><strong>5. Иная информация:</strong> ${escapeHtml(String(f.extraInfo).trim())}.</p>` : ''}
<p style="margin:28px 0 0; display:flex; justify-content:space-between; line-height:1.5;"><span>Дата: «»______ 20&nbsp;&nbsp;&nbsp;г.</span><span>Подпись: _______________ (${escapeHtml(fullNameToShort(f.fullName) || '__________')})</span></p>`
    : `<p style="margin:0 0 14px; line-height:1.5;">I, ${escapeHtml(f.fullName || '___________')}, request the following information under Art. 165 Housing Code and Decree No. 416. 1) Charges and arrears${periodPhrase11}. 1.2) Consumption${periodPhrase}. 2) ${servicesList} 3) MC contacts. 4) Tariffs.${(f.extraInfo && String(f.extraInfo).trim()) ? ' 5) ' + escapeHtml(String(f.extraInfo).trim()) + '.' : ''}</p>
<p style="margin:28px 0 0; display:flex; justify-content:space-between; line-height:1.5;"><span>Date ________</span><span>Signature ________ (${escapeHtml(fullNameToShort(f.fullName) || '__________')})</span></p>`;

  const headerHtml = `<div style="font-size:10pt; line-height:1.5; margin-bottom:24px; text-align:left;">${headerBlock}</div>`;
  const titleText = ru
    ? 'ЗАПРОС о предоставлении информации, связанной с управлением многоквартирным домом (во исполнение ст. 165 ЖК РФ и Постановления Правительства РФ № 416)'
    : 'REQUEST for information related to management of a multi-apartment building (Art. 165 Housing Code, RF Government Decree No. 416)';
  const titleHtml = `<div style="font-size:11pt; font-weight:bold; margin-bottom:24px; line-height:1.4; text-align:center;">${titleText}</div>`;
  const bodyHtml = `<div style="font-size:10pt; text-align:left;">${bodyContent}</div>`;
  return headerHtml + titleHtml + bodyHtml;
}

function doHtml2Pdf(wrap, filename, overlay) {
  function cleanup() {
    wrap.remove();
    if (overlay && overlay.parentNode) overlay.remove();
  }
  // Элемент должен быть видим на экране, иначе html2canvas даёт пустой PDF
  wrap.style.position = 'relative';
  wrap.style.left = '0';
  window.html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4' },
    })
    .from(wrap)
    .save()
    .then(cleanup)
    .catch(() => {
      cleanup();
      alert(state.lang === 'ru' ? 'Ошибка создания PDF' : 'PDF creation error');
    });
}

function downloadOrderPdf(order) {
  const f = order?.data || state.constructorForm;
  if (!f) return;
  const ru = state.lang === 'ru';

  const bodyHtml = buildPdfDocumentHtml(f, ru);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:210mm; padding:25mm; background:#fff; font-family:Arial,sans-serif; color:#000; box-sizing:border-box; line-height:1.5;';
  wrap.innerHTML = bodyHtml;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:#fff; z-index:10000; overflow:auto; display:flex; justify-content:center; padding:20px 0;';
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);

  const name = (f.ukName || 'Zapros').replace(/[^a-zA-Zа-яА-Я0-9]/g, '_').slice(0, 30);
  const filename = `Zapros_165JK_${name}_${new Date().toISOString().slice(0, 10)}.pdf`;

  function runPdf() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => doHtml2Pdf(wrap, filename, overlay));
    });
  }

  if (typeof window.html2pdf !== 'undefined') {
    runPdf();
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
  script.onload = runPdf;
  script.onerror = () => {
    overlay.remove();
    alert(state.lang === 'ru' ? 'Не удалось загрузить библиотеку PDF' : 'Failed to load PDF library');
  };
  document.head.appendChild(script);
}

function getOrderStatusLabel(approved) {
  const t = I18N[state.lang].profile;
  if (approved === true) return t.orderStatusReady;
  if (approved === false) return t.orderStatusRevision;
  return t.orderStatusInReview;
}

function canDownloadOrder(order) {
  return order?.approved === true;
}

function isOrderRevision(order) {
  return order?.approved === false;
}

function openOrderModal(order) {
  const t = I18N[state.lang].profile;
  const canDownload = canDownloadOrder(order);
  const isRevision = isOrderRevision(order);
  const preview = getLetterPreviewFromData(order?.data);
  const comment = (order?.revision_comment || '').trim();

  let actionsHtml;
  if (canDownload) {
    actionsHtml = `<button class="primary-btn" id="modal-download">${t.download || 'Скачать'}</button>
       <button class="secondary-btn" id="modal-close">${t.close || 'Закрыть'}</button>`;
  } else if (isRevision) {
    actionsHtml = `<div class="revision-comment-block" style="margin-bottom:12px;padding:12px;background:var(--bg-soft, #f5f5f5);border-radius:8px;">
         <div class="small muted-text" style="margin-bottom:6px;">${state.lang === 'ru' ? 'Комментарий эксперта:' : 'Expert comment:'}</div>
         <div class="small">${comment ? escapeHtml(comment) : (state.lang === 'ru' ? '—' : '—')}</div>
       </div>
       <div style="display:flex;gap:8px;flex-wrap:wrap;">
         <button class="primary-btn" id="modal-edit">${state.lang === 'ru' ? 'Отредактировать' : 'Edit'}</button>
         <button class="secondary-btn" id="modal-close">${t.close || 'Закрыть'}</button>
       </div>`;
  } else {
    actionsHtml = `<div class="small muted-text" style="margin-bottom:12px;">${t.orderInReviewHint}</div>
       <button class="secondary-btn" id="modal-close">${t.close || 'Закрыть'}</button>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3 class="modal-title">${t.orderPreview}</h3>
      <div class="modal-preview"><pre>${(preview || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>
      <div class="modal-actions">${actionsHtml}</div>
    </div>
  `;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px';
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#modal-close').addEventListener('click', close);

  const btnDownload = overlay.querySelector('#modal-download');
  if (btnDownload) btnDownload.addEventListener('click', () => { downloadOrderPdf(order); });

  const btnEdit = overlay.querySelector('#modal-edit');
  if (btnEdit) btnEdit.addEventListener('click', () => {
    close();
    loadOrderIntoConstructor(order);
  });
}

function openAdminOrderModal(order) {
  const t = I18N[state.lang].profile;
  const preview = getLetterPreviewFromData(order?.data);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content">
      <h3 class="modal-title">${t.orderPreview}</h3>
      <div class="modal-preview" style="max-height:70vh;overflow:auto"><pre style="white-space:pre-wrap;font-size:13px">${(preview || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>
      <div class="modal-actions">
        <button class="secondary-btn" id="admin-modal-close">${t.close || 'Закрыть'}</button>
      </div>
    </div>
  `;
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px';
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('#admin-modal-close').addEventListener('click', close);
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
  } else if (hash === "#admin") {
    renderAdmin();
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

  const navLinks = document.querySelectorAll(".nav-link:not(.admin-nav-link)");
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

  updateAdminNav();
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
              <div class="field" style="display:flex;gap:8px;flex-wrap:wrap;">
                <div style="flex:0 0 80px;">
                  <div class="stacked-label">${tForm.passportSeries}</div>
                  <input class="input" name="passportSeries" value="${state.constructorForm.passportSeries}" placeholder="0000" maxlength="4" />
                </div>
                <div style="flex:0 0 120px;">
                  <div class="stacked-label">${tForm.passportNumber}</div>
                  <input class="input" name="passportNumber" value="${state.constructorForm.passportNumber}" placeholder="000000" maxlength="6" />
                </div>
                <div style="flex:1;min-width:180px;">
                  <div class="stacked-label">${tForm.passportIssued}</div>
                  <input class="input" name="passportIssued" value="${state.constructorForm.passportIssued}" placeholder="${tForm.passportIssuedPlaceholder}" />
                </div>
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.phone}</div>
                <input class="input" name="phone" value="${state.constructorForm.phone}" placeholder="${tForm.phonePlaceholder}" type="tel" />
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
                <input class="input" name="emailForReply" value="${state.constructorForm.emailForReply}" placeholder="${tForm.emailPlaceholder}" type="email" />
              </div>
              <div class="field">
                <div class="stacked-label">${tForm.extraInfo}</div>
                <textarea class="textarea input" name="extraInfo" placeholder="${tForm.extraInfoPlaceholder}" rows="2">${(state.constructorForm.extraInfo || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
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
              <button class="primary-btn" id="btn-create-order">${state.editingOrderId ? (state.lang === 'ru' ? 'Обновить заказ' : 'Update order') : tForm.createOrder}</button>
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
              <div class="tag">practsuveren@yandex.ru</div>
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
    const textFields = ["fullName", "address", "passportSeries", "passportNumber", "passportIssued", "phone", "ukName", "ukAddress", "period", "emailForReply", "extraInfo"];
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
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = contactForm.name?.value?.trim();
      const email = contactForm.email?.value?.trim();
      const message = contactForm.message?.value?.trim();
      if (!name || !message) {
        alert(state.lang === 'ru' ? 'Укажите имя и сообщение' : 'Enter name and message');
        return;
      }
      const btn = contactForm.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      try {
        const r = await fetch(API_BASE + '/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message }),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          alert(I18N[state.lang].contacts.sendSuccess);
          contactForm.reset();
        } else {
          alert(data.error || I18N[state.lang].contacts.sendError);
        }
      } catch (err) {
        alert(I18N[state.lang].contacts.sendError);
      } finally {
        if (btn) btn.disabled = false;
      }
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

function loadOrderIntoConstructor(order) {
  if (!order?.data) return;
  const d = order.data;
  state.editingOrderId = order.id;
  state.editingDraftId = null;
  state.constructorForm = {
    fullName: d.fullName || '',
    address: d.address || '',
    passportSeries: d.passportSeries || '',
    passportNumber: d.passportNumber || '',
    passportIssued: d.passportIssued || '',
    phone: d.phone || '',
    ukName: d.ukName || '',
    ukAddress: d.ukAddress || '',
    period: d.period || '',
    emailForReply: d.emailForReply || '',
    extraInfo: d.extraInfo || '',
    services: d.services || { content: true, heating: false, water: false, repair: false },
  };
  state.withExpert = !!d.withExpert;
  window.location.hash = '#constructor';
  render();
}

function loadDraftIntoConstructor(draft) {
  if (!draft?.data) return;
  const d = draft.data;
  state.editingDraftId = draft.id;
  state.editingOrderId = null;
  state.constructorForm = {
    fullName: d.fullName || '',
    address: d.address || '',
    passportSeries: d.passportSeries || '',
    passportNumber: d.passportNumber || '',
    passportIssued: d.passportIssued || '',
    phone: d.phone || '',
    ukName: d.ukName || '',
    ukAddress: d.ukAddress || '',
    period: d.period || '',
    emailForReply: d.emailForReply || '',
    extraInfo: d.extraInfo || '',
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
      let [drafts, orders] = await Promise.all([
        fetchDrafts(),
        fetchOrders().catch(() => []),
      ]);
      state.profileDrafts = drafts || [];
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
            <div class="small muted-text">${getOrderStatusLabel(o.approved)} · ${new Date(o.created_at).toLocaleDateString()}</div>
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

// ========== ADMIN PAGE ==========

async function renderAdmin() {
  const t = I18N[state.lang].admin;
  applyLanguageToShell();

  if (!state.user) {
    appRoot.innerHTML = `
      <div class="landing">
        <section id="admin" class="section hero-section section-visible">
          <div class="neo-card section-shell">
            <h2 class="section-title">${t.title}</h2>
            <p class="section-subtitle">${state.lang === 'ru' ? 'Войдите, чтобы открыть админ-панель.' : 'Log in to open admin panel.'}</p>
            <a href="#" class="primary-btn" onclick="goToDashboard(); return false;">${state.lang === 'ru' ? 'Профиль' : 'Profile'}</a>
          </div>
        </section>
      </div>
    `;
    return;
  }

  let orders = state.adminOrders;
  let loading = false;
  try {
    loading = true;
    orders = await fetchAdminOrders();
    state.adminOrders = orders;
  } catch (e) {
    state.isAdmin = false;
    appRoot.innerHTML = `
      <div class="landing">
        <section id="admin" class="section hero-section section-visible">
          <div class="neo-card section-shell">
            <h2 class="section-title">${t.title}</h2>
            <p class="section-subtitle muted-text">${state.lang === 'ru' ? 'Доступ запрещён или требуется авторизация.' : 'Access denied or authorization required.'}</p>
            <a href="#" class="secondary-btn" onclick="window.location.hash=''; render(); return false;">&larr; ${state.lang === 'ru' ? 'На главную' : 'Back'}</a>
          </div>
        </section>
      </div>
    `;
    return;
  } finally {
    loading = false;
  }

  state.isAdmin = true;

  const statusLabel = (approved) => {
    if (approved === true) return t.statusReady;
    if (approved === false) return t.statusRevision;
    return t.statusInWork;
  };

  const formatUser = (u) => {
    if (!u) return '—';
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ');
    const un = u.username ? '@' + u.username : '';
    return [name || un || '—', un].filter(Boolean).join(' ');
  };

  appRoot.innerHTML = `
    <div class="landing">
      <section id="admin" class="section hero-section section-visible">
        <div class="neo-card section-shell">
          <h2 class="section-title">${t.title}</h2>
          <p class="section-subtitle">${t.subtitle}</p>
          <a href="#" class="secondary-btn" style="margin-bottom:20px;display:inline-block" onclick="window.location.hash=''; render(); return false;">&larr; ${state.lang === 'ru' ? 'На главную' : 'Back'}</a>
          <div id="admin-orders-list"></div>
        </div>
      </section>
    </div>
  `;

  const listEl = document.getElementById('admin-orders-list');
  if (orders.length === 0) {
    listEl.innerHTML = `<p class="small muted-text">${t.empty}</p>`;
  } else {
    listEl.innerHTML = orders
      .map(
        (o, i) => {
          const preview = formatOrderPreview(o);
          const approved = o.approved;
          const canSetReady = approved !== true;
          const canSetRevision = approved !== false;
          const id = o.id;
          return `
        <div class="neo-card admin-order-card" style="margin-bottom:16px;padding:16px" data-order-id="${id}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;margin-bottom:4px">${escapeHtml(preview)}</div>
              <div class="small muted-text">${t.user}: ${escapeHtml(formatUser(o.user))} · ${t.date}: ${new Date(o.created_at).toLocaleDateString()}</div>
              <div style="margin-top:8px"><span class="tag" style="background:var(--bg-soft);padding:4px 8px;border-radius:6px">${statusLabel(approved)}</span></div>
              ${approved === false && o.revision_comment ? `<div class="small muted-text" style="margin-top:8px">${state.lang === 'ru' ? 'Комментарий:' : 'Comment:'} ${escapeHtml(o.revision_comment)}</div>` : ''}
              <div style="margin-top:8px"><button class="secondary-btn admin-view-order" data-order-index="${i}">${t.view}</button></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;flex-shrink:0">
              ${canSetReady ? `<button class="secondary-btn admin-set-ready" data-order-id="${id}">${t.setReady}</button>` : ''}
              ${canSetRevision ? `
                <div class="admin-revision-row" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <input type="text" class="input admin-comment-input" data-order-id="${id}" placeholder="${t.commentPlaceholder}" value="${escapeHtml(o.revision_comment || '')}" />
                  <button class="secondary-btn admin-set-revision" data-order-id="${id}" data-comment-input="admin-comment-${i}">${t.setRevision}</button>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
        }
      )
      .join('');

    listEl.querySelectorAll('.admin-view-order').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-order-index'), 10);
        const order = state.adminOrders[idx];
        if (order) openAdminOrderModal(order);
      });
    });

    listEl.querySelectorAll('.admin-set-ready').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-order-id');
        try {
          await patchAdminOrderStatus(id, true, '');
          const idx = state.adminOrders.findIndex((o) => o.id === id);
          if (idx >= 0) state.adminOrders[idx] = { ...state.adminOrders[idx], approved: true, revision_comment: '' };
          renderAdmin();
        } catch (e) {
          alert(state.lang === 'ru' ? 'Ошибка: ' + e.message : 'Error: ' + e.message);
        }
      });
    });

    listEl.querySelectorAll('.admin-set-revision').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-order-id');
        const card = listEl.querySelector(`[data-order-id="${id}"]`);
        const input = card?.querySelector('.admin-comment-input');
        const comment = (input?.value || '').trim();
        if (!comment) {
          alert(state.lang === 'ru' ? 'Введите комментарий для доработки.' : 'Enter revision comment.');
          return;
        }
        try {
          await patchAdminOrderStatus(id, false, comment);
          const idx = state.adminOrders.findIndex((o) => o.id === id);
          if (idx >= 0) state.adminOrders[idx] = { ...state.adminOrders[idx], approved: false, revision_comment: comment };
          renderAdmin();
        } catch (e) {
          alert(state.lang === 'ru' ? 'Ошибка: ' + e.message : 'Error: ' + e.message);
        }
      });
    });
  }
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

function openBlogPostModal(t, ru) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:500px;max-height:90vh;overflow:auto;background:var(--bg);border-radius:var(--radius-lg);padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px">${t.createPost}</h3>
        <button type="button" class="blog-modal-close" aria-label="Close" style="background:0;border:0;font-size:24px;cursor:pointer;color:var(--text-muted)">&times;</button>
      </div>
      <form id="blog-create-form">
        <div class="field"><div class="stacked-label">${t.titleRu}</div><input class="input" name="title_ru" /></div>
        <div class="field"><div class="stacked-label">${t.titleEn}</div><input class="input" name="title_en" /></div>
        <div class="field"><div class="stacked-label">${t.bodyRu}</div><textarea class="textarea input" name="body_ru" rows="4"></textarea></div>
        <div class="field"><div class="stacked-label">${t.bodyEn}</div><textarea class="textarea input" name="body_en" rows="4"></textarea></div>
        <div class="field">
          <div class="stacked-label">${t.addPhoto} / ${t.addVideo}</div>
          <input type="file" id="blog-media-input" accept="image/*,video/*" multiple />
          <div class="small muted-text" style="margin-top:4px">${t.orPasteUrl}</div>
          <input type="url" id="blog-media-url" class="input" placeholder="https://..." style="margin-top:4px" />
          <div id="blog-media-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button type="submit" class="primary-btn">${t.publish}</button>
          <button type="button" class="secondary-btn blog-modal-close">${ru ? 'Закрыть' : 'Close'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('.blog-modal-close').forEach(b => b.addEventListener('click', close));

  let media = [];
  const form = overlay.querySelector('#blog-create-form');
  const mediaInput = overlay.querySelector('#blog-media-input');
  const mediaUrl = overlay.querySelector('#blog-media-url');
  const preview = overlay.querySelector('#blog-media-preview');

  if (mediaInput) mediaInput.addEventListener('change', async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      try {
        const m = await uploadBlogMedia(f);
        media.push(m);
        preview.innerHTML += m.type === 'video' ? `<video controls style="width:80px;height:60px;object-fit:cover;border-radius:6px" src="${escapeHtml(m.url)}"></video>` : `<img src="${escapeHtml(m.url)}" style="width:80px;height:60px;object-fit:cover;border-radius:6px" alt="" />`;
      } catch (err) { alert(err.message); }
    }
    mediaInput.value = '';
  });
  if (mediaUrl) mediaUrl.addEventListener('keypress', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const url = mediaUrl.value.trim();
    if (!url) return;
    const type = /\.(mp4|webm|ogg|mov)$/i.test(url) ? 'video' : 'photo';
    media.push({ type, url });
    preview.innerHTML += type === 'video' ? `<video controls style="width:80px;height:60px;object-fit:cover;border-radius:6px" src="${escapeHtml(url)}"></video>` : `<img src="${escapeHtml(url)}" style="width:80px;height:60px;object-fit:cover;border-radius:6px" alt="" />`;
    mediaUrl.value = '';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title_ru = (fd.get('title_ru') || '').toString().trim();
    const title_en = (fd.get('title_en') || '').toString().trim();
    const body_ru = (fd.get('body_ru') || '').toString().trim();
    const body_en = (fd.get('body_en') || '').toString().trim();
    if (!title_ru && !title_en) { alert(ru ? 'Укажите заголовок' : 'Enter title'); return; }
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await createBlogPost({ title_ru, title_en, body_ru, body_en, media });
      close();
      alert(t.postCreated);
      renderBlog();
    } catch (err) { alert(err.message); }
    finally { if (btn) btn.disabled = false; }
  });
}

function openBlogEditModal(post, t, ru) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:500px;max-height:90vh;overflow:auto;background:var(--bg);border-radius:var(--radius-lg);padding:24px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 style="margin:0;font-size:18px">${t.editPost}</h3>
        <button type="button" class="blog-modal-close" aria-label="Close" style="background:0;border:0;font-size:24px;cursor:pointer;color:var(--text-muted)">&times;</button>
      </div>
      <form id="blog-edit-form">
        <div class="field"><div class="stacked-label">${t.titleRu}</div><input class="input" name="title_ru" value="${escapeHtml(post.title_ru || '')}" /></div>
        <div class="field"><div class="stacked-label">${t.titleEn}</div><input class="input" name="title_en" value="${escapeHtml(post.title_en || '')}" /></div>
        <div class="field"><div class="stacked-label">${t.bodyRu}</div><textarea class="textarea input" name="body_ru" rows="4">${escapeHtml(post.body_ru || '')}</textarea></div>
        <div class="field"><div class="stacked-label">${t.bodyEn}</div><textarea class="textarea input" name="body_en" rows="4">${escapeHtml(post.body_en || '')}</textarea></div>
        <div class="field">
          <div class="stacked-label">${t.addPhoto} / ${t.addVideo}</div>
          <input type="file" id="blog-edit-media-input" accept="image/*,video/*" multiple />
          <div class="small muted-text" style="margin-top:4px">${t.orPasteUrl}</div>
          <input type="url" id="blog-edit-media-url" class="input" placeholder="https://..." style="margin-top:4px" />
          <div id="blog-edit-media-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button type="submit" class="primary-btn">${ru ? 'Сохранить' : 'Save'}</button>
          <button type="button" class="secondary-btn blog-modal-close">${ru ? 'Закрыть' : 'Close'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('.blog-modal-close').forEach(b => b.addEventListener('click', close));

  let media = Array.isArray(post.media) ? post.media.map(m => ({ type: m.type || 'photo', url: m.url || m.src })) : [];
  const form = overlay.querySelector('#blog-edit-form');
  const mediaInput = overlay.querySelector('#blog-edit-media-input');
  const mediaUrl = overlay.querySelector('#blog-edit-media-url');
  const preview = overlay.querySelector('#blog-edit-media-preview');
  (post.media || []).forEach(m => {
    const url = m.url || m.src;
    if (!url) return;
    preview.innerHTML += m.type === 'video' ? `<video controls style="width:80px;height:60px;object-fit:cover;border-radius:6px" src="${escapeHtml(url)}"></video>` : `<img src="${escapeHtml(url)}" style="width:80px;height:60px;object-fit:cover;border-radius:6px" alt="" />`;
  });

  if (mediaInput) mediaInput.addEventListener('change', async (e) => {
    for (const f of Array.from(e.target.files || [])) {
      try {
        const m = await uploadBlogMedia(f);
        media.push(m);
        preview.innerHTML += m.type === 'video' ? `<video controls style="width:80px;height:60px;object-fit:cover;border-radius:6px" src="${escapeHtml(m.url)}"></video>` : `<img src="${escapeHtml(m.url)}" style="width:80px;height:60px;object-fit:cover;border-radius:6px" alt="" />`;
      } catch (err) { alert(err.message); }
    }
    mediaInput.value = '';
  });
  if (mediaUrl) mediaUrl.addEventListener('keypress', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const url = mediaUrl.value.trim();
    if (!url) return;
    const type = /\.(mp4|webm|ogg|mov)$/i.test(url) ? 'video' : 'photo';
    media.push({ type, url });
    preview.innerHTML += type === 'video' ? `<video controls style="width:80px;height:60px;object-fit:cover;border-radius:6px" src="${escapeHtml(url)}"></video>` : `<img src="${escapeHtml(url)}" style="width:80px;height:60px;object-fit:cover;border-radius:6px" alt="" />`;
    mediaUrl.value = '';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title_ru = (fd.get('title_ru') || '').toString().trim();
    const title_en = (fd.get('title_en') || '').toString().trim();
    const body_ru = (fd.get('body_ru') || '').toString().trim();
    const body_en = (fd.get('body_en') || '').toString().trim();
    if (!title_ru && !title_en) { alert(ru ? 'Укажите заголовок' : 'Enter title'); return; }
    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      await updateBlogPost(post.id, { title_ru, title_en, body_ru, body_en, media });
      close();
      alert(t.postUpdated);
      renderBlog();
    } catch (err) { alert(err.message); }
    finally { if (btn) btn.disabled = false; }
  });
}

function renderBlog() {
  const t = I18N[state.lang].blog;
  const ru = state.lang === 'ru';
  appRoot.innerHTML = `
    <div class="blog-page-wrap" style="position:relative;padding:20px 0">
      <div class="neo-card blog-hero-card" style="position:relative;padding:40px 30px;text-align:center">
        <button type="button" class="blog-add-btn" id="blog-add-btn" title="${t.createPost}" aria-label="${t.createPost}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <a href="#" class="back-link">← ${t.backLink}</a>
        <h1 class="page-title" style="margin:16px 0 0">${t.title}</h1>
      </div>
      <section class="blog-posts" id="blog-posts" style="margin-top:24px">
        <p class="small muted-text">${ru ? 'Загрузка...' : 'Loading...'}</p>
      </section>
    </div>
  `;

  document.getElementById('blog-add-btn')?.addEventListener('click', () => openBlogPostModal(t, ru));
  document.querySelector('.back-link')?.addEventListener('click', (e) => { e.preventDefault(); window.location.hash = ''; render(); });

  (async () => {
    try {
      await Promise.race([fetchBlogPosts(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 8000))]);
    } catch { state.blogPosts = []; }
    const postsEl = document.getElementById('blog-posts');
    if (!postsEl) return;
    if (!state.blogPosts || state.blogPosts.length === 0) {
      postsEl.innerHTML = `<p class="small muted-text">${t.noPosts}</p>`;
      return;
    }
    const formatDate = (d) => d ? new Date(d).toLocaleDateString(ru ? 'ru-RU' : 'en-US') : '';
    for (const post of state.blogPosts) {
      try {
        post.comments = await fetchBlogComments(post.id).catch(() => []);
      } catch { post.comments = []; }
    }
    const adminBtns = (p) => state.isAdmin ? `<div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="secondary-btn blog-edit-post" data-post-id="${p.id}">${t.editPost}</button><button type="button" class="secondary-btn blog-delete-post" data-post-id="${p.id}">${t.deletePost}</button></div>` : '';
    postsEl.innerHTML = state.blogPosts.map(post => {
      const title = ru ? (post.title_ru || post.title_en) : (post.title_en || post.title_ru);
      const body = ru ? (post.body_ru || post.body_en) : (post.body_en || post.body_ru);
      const mediaHtml = (post.media || []).map(m => {
        const url = m.url || m.src;
        return m.type === 'video' ? `<video controls style="max-width:100%;max-height:400px;border-radius:8px;margin:8px 0" src="${escapeHtml(url)}"></video>` : `<img src="${escapeHtml(url)}" alt="" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;margin:8px 0;display:block" loading="lazy">`;
      }).join('');
      const comments = post.comments || [];
      const commentsList = comments.length === 0
        ? `<p class="small muted-text" style="margin:0 0 12px">${t.commentsEmpty}</p>`
        : comments.map(c => `<div style="background:var(--bg-elevated);border-radius:8px;padding:12px 16px;margin-bottom:8px"><div style="font-weight:600;font-size:13px;color:var(--accent);margin-bottom:4px">${escapeHtml(c.author_name || '—')}</div><div style="font-size:14px;line-height:1.5">${escapeHtml(c.text)}</div></div>`).join('');
      return `
        <article class="neo-card blog-post-card" data-post-id="${post.id}" style="padding:24px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <h2 style="font-size:20px;margin:0 0 8px">${escapeHtml(title)}</h2>
              <span class="small muted-text">${formatDate(post.created_at)}</span>
            </div>
            ${adminBtns(post)}
          </div>
          ${mediaHtml}
          <p style="white-space:pre-wrap;margin:16px 0 0;line-height:1.6">${escapeHtml(body)}</p>
          <div class="blog-comments" style="border-top:1px solid var(--border);margin-top:20px;padding-top:16px">
            <h3 style="font-size:16px;margin:0 0 12px">${t.commentsTitle} (${comments.length})</h3>
            <div class="comments-list" style="margin-bottom:12px">${commentsList}</div>
            <textarea class="input comment-textarea" data-post-id="${post.id}" placeholder="${t.commentPlaceholder}" rows="3" style="width:100%;margin-bottom:8px;resize:vertical"></textarea>
            <button type="button" class="primary-btn btn-add-comment" data-post-id="${post.id}">${t.commentButton}</button>
          </div>
        </article>
      `;
    }).join('');

    document.querySelectorAll('.btn-add-comment').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.getAttribute('data-post-id');
        const textarea = document.querySelector(`.comment-textarea[data-post-id="${postId}"]`);
        const text = textarea?.value?.trim();
        if (!text) return;
        if (!state.user) { alert(t.loginToComment); return; }
        try {
          await addBlogComment(postId, text);
          const post = state.blogPosts.find(p => p.id === postId);
          if (post) post.comments = await fetchBlogComments(postId);
          renderBlog();
        } catch (e) { alert(e.message); }
      });
    });

    document.querySelectorAll('.blog-edit-post').forEach(btn => {
      btn.addEventListener('click', () => {
        const postId = btn.getAttribute('data-post-id');
        const post = state.blogPosts.find(p => p.id === postId);
        if (post) openBlogEditModal(post, t, ru);
      });
    });
    document.querySelectorAll('.blog-delete-post').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(t.confirmDelete)) return;
        const postId = btn.getAttribute('data-post-id');
        try {
          await deleteBlogPost(postId);
          alert(t.postDeleted);
          renderBlog();
        } catch (e) { alert(e.message); }
      });
    });
  })();
}

// ========== PROFILE UI ==========

function updateAdminNav() {
  const link = document.getElementById('admin-nav-link');
  if (link) {
    link.style.display = state.isAdmin ? '' : 'none';
    link.textContent = state.lang === 'ru' ? 'Админ' : 'Admin';
  }
}

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
      if (href === "#blog" || href === "#admin") {
        e.preventDefault();
        window.location.hash = href || "#";
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

  window.addEventListener("hashchange", () => {
    window.scrollTo(0, 0);
    render();
  });

  state.blogPosts = [];
  initProfile();

  initAuth().then(() => render());
}

initShell();
