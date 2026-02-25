// Конструкт — фронтенд, демо-режим без бэкенда

// Предопределённые переменные для шаблонов (админ выбирает, какие поля показывать пользователю).
// key — подстановка {{key}} в тексте шаблона, labelRu/labelEn — подпись поля в форме.
const PREDEFINED_VARIABLES = [
  { key: 'fullName', labelRu: 'ФИО полностью', labelEn: 'Full name' },
  { key: 'address', labelRu: 'Адрес регистрации и фактического проживания', labelEn: 'Registration and actual address' },
  { key: 'passportSeries', labelRu: 'Паспорт: серия', labelEn: 'Passport: series' },
  { key: 'passportNumber', labelRu: 'Паспорт: номер', labelEn: 'Passport: number' },
  { key: 'passportIssued', labelRu: 'Паспорт: кем и когда выдан', labelEn: 'Passport: issued by' },
  { key: 'phone', labelRu: 'Контактный телефон', labelEn: 'Contact phone' },
  { key: 'ukName', labelRu: 'Кому (название УК / ФИО директора)', labelEn: 'To (MC name / director)' },
  { key: 'ukAddress', labelRu: 'Адрес УК', labelEn: 'MC address' },
  { key: 'period', labelRu: 'Период начислений', labelEn: 'Billing period' },
  { key: 'accountNumber', labelRu: 'Номер лицевого счёта (необязательно)', labelEn: 'Account number (optional)' },
  { key: 'emailForReply', labelRu: 'Email для ответа', labelEn: 'Email for reply' },
  { key: 'extraInfo', labelRu: 'Иная информация (необязательно)', labelEn: 'Other information (optional)' },
  { key: 'inn', labelRu: 'ИНН', labelEn: 'Tax ID (INN)' },
  { key: 'kpp', labelRu: 'КПП', labelEn: 'KPP' },
  { key: 'ooo', labelRu: 'Наименование организации (ООО/АО)', labelEn: 'Organization name (LLC/JSC)' },
  { key: 'legalAddress', labelRu: 'Юридический адрес', labelEn: 'Legal address' },
  { key: 'postAddress', labelRu: 'Почтовый адрес', labelEn: 'Postal address' },
  { key: 'bik', labelRu: 'БИК банка', labelEn: 'Bank BIK' },
  { key: 'bankName', labelRu: 'Название банка', labelEn: 'Bank name' },
  { key: 'bankAccount', labelRu: 'Расчётный счёт', labelEn: 'Bank account' },
  { key: 'position', labelRu: 'Должность', labelEn: 'Position' },
  { key: 'snils', labelRu: 'СНИЛС', labelEn: 'SNILS' },
  { key: 'birthDate', labelRu: 'Дата рождения', labelEn: 'Date of birth' },
  { key: 'birthPlace', labelRu: 'Место рождения', labelEn: 'Place of birth' },
  { key: 'cadastralNumber', labelRu: 'Кадастровый номер помещения', labelEn: 'Cadastral number' },
  { key: 'contractNumber', labelRu: 'Номер договора', labelEn: 'Contract number' },
  { key: 'contractDate', labelRu: 'Дата договора', labelEn: 'Contract date' },
  { key: 'claimAmount', labelRu: 'Сумма требований (руб.)', labelEn: 'Claim amount (RUB)' },
  { key: 'reason', labelRu: 'Основание (причина запроса)', labelEn: 'Reason for request' },
  { key: 'deliveryMethod', labelRu: 'Способ получения ответа', labelEn: 'Response delivery method' },
];

const state = {
  route: "home",
  lang: "ru",
  user: null,
  token: null,
  documents: [],
  draft: null,
  blogPosts: [],
  templates: [],
  templateVariables: [], // справочник переменных из БД (template_variables)
  constructorForm: {
    templateId: "",
    fields: {}, // значения полей по ключу переменной (key → value); список ключей задаётся шаблоном
    services: {
      coldWater: false,
      hotWater: false,
      wastewater: false,
      electricity: false,
      gas: false,
      heating: false,
      solidWaste: false,
      // старые ключи (templateVariablesLabel/addField/customField) больше не используем — переменные теперь управляются через таблицу template_variables
    },
  },
  withExpert: false,
  checkoutOrderId: null,
  isLoading: false,
  profileTab: "drafts",
  adminTab: "orders",
  pricing: {
    base_price_rub: 700,
    expert_price_rub: 2200,
  },
  appearance: null,
  texts: [],
  adminTexts: [],
  editingDraftId: null,
  editingOrderId: null,
  isAdmin: false,
  adminOrders: [],
  adminTemplates: [],
};

// ========== AUTH (TMA + Telegram Widget → Supabase, 1 аккаунт по telegram_id) ==========

const API_BASE = ''; // тот же домен

function isInTelegramWebApp() {
  return !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
}

async function fetchConfig() {
  // cache-bust, чтобы после админских изменений переменных/шаблонов обновлялось сразу
  const r = await fetch(API_BASE + '/api/config?t=' + Date.now());
  return r.json();
}

function setTemplateVariables(list) {
  state.templateVariables = Array.isArray(list) ? list : [];
}

function setPricing(pricing) {
  if (pricing && typeof pricing === 'object') {
    const base = Number(pricing.base_price_rub);
    const expert = Number(pricing.expert_price_rub);
    if (Number.isFinite(base) && base > 0 && Number.isInteger(base) &&
        Number.isFinite(expert) && expert > 0 && Number.isInteger(expert)) {
      state.pricing = {
        base_price_rub: base,
        expert_price_rub: expert,
      };
      return;
    }
  }
  state.pricing = {
    base_price_rub: 700,
    expert_price_rub: 2200,
  };
}

function hexToRgba(hex, alpha) {
  if (!hex) return '';
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6) return '';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return '';
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resetAppearanceToDefaults() {
  const root = document.documentElement;
  root.style.removeProperty('--bg');
  root.style.removeProperty('--bg-elevated');
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-soft');
  root.style.removeProperty('--border');
  root.style.removeProperty('--header-bg');
  root.style.removeProperty('--footer-bg');
  root.style.removeProperty('--card-bg');
  root.style.removeProperty('--tabs-bg');
  root.style.removeProperty('--preview-bg');
  root.style.removeProperty('--btn-primary-bg');
  root.style.removeProperty('--btn-primary-text');
  root.style.removeProperty('--btn-secondary-bg');
  root.style.removeProperty('--btn-secondary-text');
  document.body.style.background = '';
}

function applyAppearance(appearance) {
  const root = document.documentElement;
  if (!appearance) {
    resetAppearanceToDefaults();
    return;
  }
  const bg = appearance.bg_color;
  const bgElevated = appearance.bg_elevated_color;
  const accent = appearance.accent_color;
  const border = appearance.border_color;
  const gradFrom = appearance.bg_gradient_from;
  const gradTo = appearance.bg_gradient_to;

  if (bg) root.style.setProperty('--bg', bg);
  if (bgElevated) root.style.setProperty('--bg-elevated', bgElevated);
  if (border) root.style.setProperty('--border', border);
  if (appearance.header_bg) root.style.setProperty('--header-bg', appearance.header_bg);
  if (appearance.footer_bg) root.style.setProperty('--footer-bg', appearance.footer_bg);
  if (appearance.card_bg) root.style.setProperty('--card-bg', appearance.card_bg);
  if (appearance.tabs_bg) root.style.setProperty('--tabs-bg', appearance.tabs_bg);
  if (appearance.preview_bg) root.style.setProperty('--preview-bg', appearance.preview_bg);
  if (accent) {
    root.style.setProperty('--accent', accent);
    const soft = hexToRgba(accent, 0.12);
    if (soft) root.style.setProperty('--accent-soft', soft);
  }
  if (gradFrom && gradTo) {
    document.body.style.background = `radial-gradient(circle at top left, ${gradFrom}, ${gradTo} 55%)`;
  }
  if (appearance.primary_btn_bg) {
    root.style.setProperty('--btn-primary-bg', appearance.primary_btn_bg);
  }
  if (appearance.primary_btn_text) {
    root.style.setProperty('--btn-primary-text', appearance.primary_btn_text);
  }
  if (appearance.secondary_btn_bg) {
    root.style.setProperty('--btn-secondary-bg', appearance.secondary_btn_bg);
  }
  if (appearance.secondary_btn_text) {
    root.style.setProperty('--btn-secondary-text', appearance.secondary_btn_text);
  }
}

function setAppearance(appearance) {
  if (appearance && typeof appearance === 'object') {
    state.appearance = {
      bg_color: appearance.bg_color || null,
      bg_elevated_color: appearance.bg_elevated_color || null,
      bg_gradient_from: appearance.bg_gradient_from || null,
      bg_gradient_to: appearance.bg_gradient_to || null,
      accent_color: appearance.accent_color || null,
      border_color: appearance.border_color || null,
      header_bg: appearance.header_bg || null,
      footer_bg: appearance.footer_bg || null,
      card_bg: appearance.card_bg || null,
      tabs_bg: appearance.tabs_bg || null,
      preview_bg: appearance.preview_bg || null,
      primary_btn_bg: appearance.primary_btn_bg || null,
      primary_btn_text: appearance.primary_btn_text || null,
      secondary_btn_bg: appearance.secondary_btn_bg || null,
      secondary_btn_text: appearance.secondary_btn_text || null,
    };
  } else {
    state.appearance = null;
  }
  applyAppearance(state.appearance);
}

function setTextByPath(lang, path, value) {
  if (!lang || !path) return;
  const parts = path.split('.');
  let obj = I18N[lang];
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!obj || typeof obj !== 'object') return;
    if (!(p in obj)) return;
    obj = obj[p];
  }
  const last = parts[parts.length - 1];
  if (obj && Object.prototype.hasOwnProperty.call(obj, last)) {
    obj[last] = value;
  }
}

function applyTextOverrides(texts) {
  if (!Array.isArray(texts)) return;
  texts.forEach((t) => {
    const lang = (t.lang || '').toLowerCase();
    const key = String(t.key || '').trim();
    if (!key || (lang !== 'ru' && lang !== 'en')) return;
    setTextByPath(lang, key, String(t.value || ''));
  });
}

function setTexts(list) {
  state.texts = Array.isArray(list) ? list : [];
  applyTextOverrides(state.texts);
}

function getTemplateVariables(tpl) {
  if (!tpl || !tpl.content) return [];
  const header = tpl.content.header || {};
  const title = tpl.content.title || {};
  const body = tpl.content.body || {};

  const chunks = [];
  ['ru', 'en'].forEach((lng) => {
    if (header[lng]) chunks.push(String(header[lng]));
    if (title[lng]) chunks.push(String(title[lng]));
    if (body[lng]) chunks.push(String(body[lng]));
  });
  Object.keys(header).forEach((k) => {
    if (k !== 'ru' && k !== 'en' && header[k]) chunks.push(String(header[k]));
  });
  Object.keys(title).forEach((k) => {
    if (k !== 'ru' && k !== 'en' && title[k]) chunks.push(String(title[k]));
  });
  Object.keys(body).forEach((k) => {
    if (k !== 'ru' && k !== 'en' && body[k]) chunks.push(String(body[k]));
  });

  const text = chunks.join('\n');
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const keysSet = new Set();
  let m;
  // Вытащить все {{key}} из шаблона
  while ((m = re.exec(text))) {
    if (m[1]) keysSet.add(m[1]);
  }

  const keys = Array.from(keysSet);
  if (!keys.length) return [];

  const vars = keys.map((key) => {
    const dict = (state.templateVariables || []).find((v) => v.key === key);
    const def = PREDEFINED_VARIABLES.find((v) => v.key === key);
    return {
      key,
      label: dict
        ? (state.lang === 'ru' ? (dict.label_ru || key) : (dict.label_en || key))
        : (def ? (state.lang === 'ru' ? def.labelRu : def.labelEn) : key),
    };
  });

  // Сортировка по справочнику переменных из БД (sort_order), остальные — по алфавиту
  vars.sort((a, b) => {
    const da = (state.templateVariables || []).find((v) => v.key === a.key);
    const db = (state.templateVariables || []).find((v) => v.key === b.key);
    const ia = da ? (da.sort_order ?? 0) : null;
    const ib = db ? (db.sort_order ?? 0) : null;
    if (ia == null && ib == null) return a.key.localeCompare(b.key);
    if (ia == null) return 1;
    if (ib == null) return -1;
    if (ia !== ib) return ia - ib;
    return a.key.localeCompare(b.key);
  });

  return vars;
}

function getBuiltInTemplates() {
  return [
    {
      id: 'builtin-402',
      name: '402‑ФЗ — документы-основания начислений',
      description: 'Встроенный шаблон (fallback).',
      sort_order: 0,
      is_active: true,
      content: {
        version: 1,
        header: {
          ru: "Кому: {{ukName}}\nОт: {{fullName}}\nПаспорт: серия {{passportSeries}} номер {{passportNumber}}, выдан {{passportIssued}}\nАдрес регистрации: {{address}}\nКонтактный телефон: {{phone}}  Email: {{emailForReply}}",
          en: "To: {{ukName}}\nFrom: {{fullName}}\nPassport: series {{passportSeries}} no. {{passportNumber}}, issued {{passportIssued}}\nAddress: {{address}}\nPhone: {{phone}}  Email: {{emailForReply}}",
        },
        title: {
          ru: "ЗАПРОС\nо предоставлении документов, послуживших основанием для начисления платы за жилищно-коммунальные услуги\n(в соответствии с Федеральным законом № 402-ФЗ)",
          en: "REQUEST\nfor documents forming the basis for housing and коммунal service charges\n(pursuant to Federal Law No. 402-FZ)",
        },
        body: {
          ru:
            "Я, {{fullName}}, являюсь собственником/нанимателем жилого помещения по вышеуказанному адресу.\n\n" +
            "На основании Федерального закона от 04.06.2011 № 402-ФЗ «О внесении изменений в Жилищный кодекс Российской Федерации и отдельные законодательные акты Российской Федерации» ПРОШУ:\n\n" +
            "Предоставить мне заверенные копии следующих документов (сведений), послуживших основанием для начисления платы за жилищно-коммунальные услуги по моему лицевому счету № {{accountNumber}} за период {{period}}:\n\n" +
            "- Договор управления многоквартирным домом со всеми приложениями и дополнительными соглашениями.\n" +
            "- Протоколы общих собраний собственников, на которых утверждались:\n" +
            "  - размер платы за содержание и ремонт жилого помещения;\n" +
            "  - перечень услуг и работ по содержанию и ремонту общего имущества;\n" +
            "  - тарифы на коммунальные услуги (при наличии).\n" +
            "- Расчет размера платы за коммунальные услуги с указанием применяемых тарифов, нормативов потребления, показаний приборов учета.\n" +
            "- Акты выполненных работ (оказанных услуг) по содержанию и ремонту общего имущества за указанный период.\n" +
            "- Сведения о наличии (отсутствии) задолженности по оплате жилищно-коммунальных услуг с детализацией по видам услуг.\n" +
            "- Иные документы, на основании которых производились начисления по моему лицевому счету.\n\n" +
            "Способ получения ответа:\n" +
            "Прошу направить письменный ответ с приложением заверенных копий документов почтовым отправлением по вышеуказанному адресу / выдать на руки при личном обращении (нужное подчеркнуть).\n\n" +
            "Дата: «»______ 20   г.\n" +
            "Подпись: _______________ / {{fullName}}",
          en:
            "I, {{fullName}}, am the owner/tenant of the residential premises at the above address.\n\n" +
            "Pursuant to Federal Law dated 04.06.2011 No. 402-FZ, I REQUEST:\n\n" +
            "Please provide certified copies of the following documents (information) that served as the basis for charging fees for my personal account No. {{accountNumber}} for the period {{period}}:\n\n" +
            "- The building management agreement with all appendices and amendments.\n" +
            "- Minutes of the general meetings of owners approving:\n" +
            "  - maintenance and repair fees;\n" +
            "  - the list of services and works for common property;\n" +
            "  - communal tariffs (if applicable).\n" +
            "- Calculation of the fee amount with applied tariffs, consumption norms, and meter readings.\n" +
            "- Acts of completed works (rendered services) for the specified period.\n" +
            "- Information on outstanding debt (or absence of debt) with breakdown by service type.\n" +
            "- Other documents on the basis of which charges were made for my personal account.\n\n" +
            "Response delivery method:\n" +
            "Please send a written response with certified copies by mail to the address above / hand over in person (underline as appropriate).\n\n" +
            "Date ________\n" +
            "Signature ____________ / {{fullName}}",
        },
      },
      // legacy keys kept for compatibility
    },
  ];
}

function ensureConstructorFieldsForTemplate(tpl) {
  const variables = getTemplateVariables(tpl);
  const keys = new Set((variables || []).map((v) => v.key));
  const fields = { ...(state.constructorForm.fields || {}) };
  keys.forEach((k) => {
    if (fields[k] === undefined) fields[k] = '';
  });
  state.constructorForm = { ...state.constructorForm, fields };
}

function setTemplates(list) {
  const templates = Array.isArray(list) && list.length ? list : getBuiltInTemplates();
  state.templates = templates;
  const ids = new Set(templates.map((t) => String(t.id)));
  const current = state.constructorForm.templateId ? String(state.constructorForm.templateId) : '';
  const nextId = current && ids.has(current) ? current : String(templates[0]?.id || '');
  if (nextId && nextId !== current) {
    state.constructorForm = { ...state.constructorForm, templateId: nextId };
  }
  const tpl = templates.find((t) => String(t.id) === String(state.constructorForm.templateId)) || templates[0];
  if (tpl) ensureConstructorFieldsForTemplate(tpl);
}

async function initAppConfig() {
  try {
    const cfg = await fetchConfig();
    setTemplates(cfg?.templates);
    setTemplateVariables(cfg?.variables);
    setPricing(cfg?.pricing);
    setAppearance(cfg?.appearance);
    setTexts(cfg?.texts || []);
  } catch {
    setTemplates([]);
    setTemplateVariables([]);
    setPricing(null);
    setAppearance(null);
    setTexts([]);
  }
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
  if (method === 'GET') {
    const qs = new URLSearchParams();
    if (payload.initData) qs.set('initData', payload.initData);
    if (payload.resource) qs.set('resource', payload.resource);
    const s = qs.toString();
    if (s) url += '?' + s;
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

async function createPaymentApi(orderData, withExpert, receiptEmail) {
  const headers = { 'Content-Type': 'application/json' };
  const payload = { orderData: { ...orderData, withExpert }, withExpert, receiptEmail };
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) {
    payload.initData = window.Telegram.WebApp.initData;
  } else if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  } else {
    throw new Error('Необходима авторизация');
  }
  const res = await fetch(API_BASE + '/api/create-payment', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка создания платежа');
  return data;
}

async function updateOrderInApi(id, orderData) {
  const data = await ordersApi('PUT', { id, data: orderData });
  return data.order;
}

async function syncPaymentApi() {
  const headers = { 'Content-Type': 'application/json' };
  const payload = {};
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) {
    payload.initData = window.Telegram.WebApp.initData;
  } else if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  } else {
    throw new Error('Необходима авторизация');
  }
  const res = await fetch(API_BASE + '/api/sync-payment', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка синхронизации');
  return data;
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
  if (method === 'GET') {
    const params = new URLSearchParams();
    if (payload.resource) params.set('resource', payload.resource);
    if (payload.initData) params.set('initData', payload.initData);
    const qs = params.toString();
    if (qs) url += '?' + qs;
    // тело для GET не отправляем
    payload = {};
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

async function fetchAdminTemplates() {
  const data = await adminOrdersApi('GET', { resource: 'templates' });
  return data.templates || [];
}

async function fetchAdminVariables() {
  const data = await adminOrdersApi('GET', { resource: 'variables' });
  return data.variables || [];
}

async function createAdminVariable(variable) {
  const data = await adminOrdersApi('POST', { resource: 'variables', variable });
  return data.variable;
}

async function deleteAdminVariable(id) {
  const data = await adminOrdersApi('DELETE', { resource: 'variables', id });
  return data;
}

async function createAdminTemplate(tpl) {
  const data = await adminOrdersApi('POST', { resource: 'templates', template: tpl });
  return data.template;
}

async function updateAdminTemplate(id, tpl) {
  const data = await adminOrdersApi('PUT', { resource: 'templates', id, template: tpl });
  return data.template;
}

async function deleteAdminTemplate(id) {
  const data = await adminOrdersApi('DELETE', { resource: 'templates', id });
  return data;
}

async function patchAdminOrderStatus(id, approved, revision_comment) {
  const data = await adminOrdersApi('PATCH', { id, approved, revision_comment });
  return data.order;
}

async function fetchAdminPricing() {
  const data = await adminOrdersApi('GET', { resource: 'pricing' });
  return data.pricing || { base_price_rub: 700, expert_price_rub: 2200 };
}

async function updateAdminPricing(pricing) {
  const data = await adminOrdersApi('PUT', { resource: 'pricing', pricing });
  return data.pricing;
}

async function fetchAdminAppearance() {
  const data = await adminOrdersApi('GET', { resource: 'appearance' });
  return data.appearance || null;
}

async function updateAdminAppearance(appearance) {
  const data = await adminOrdersApi('PUT', { resource: 'appearance', appearance });
  return data.appearance;
}

async function resetAdminAppearance() {
  await adminOrdersApi('DELETE', { resource: 'appearance' });
}

async function fetchAdminTexts() {
  const data = await adminOrdersApi('GET', { resource: 'texts' });
  return data.texts || [];
}

async function saveAdminTexts(texts) {
  const data = await adminOrdersApi('PUT', { resource: 'texts', texts });
  return data.texts || [];
}

async function resetAdminTexts() {
  await adminOrdersApi('DELETE', { resource: 'texts' });
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

async function deleteBlogComment(commentId) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  let url = API_BASE_BLOG + '/api/blog?commentId=' + encodeURIComponent(commentId);
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) {
    url += '&initData=' + encodeURIComponent(window.Telegram.WebApp.initData);
  }
  const res = await fetch(url, { method: 'DELETE', headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка');
  return data;
}

async function updateBlogComment(commentId, text) {
  const payload = { commentId, text: String(text || '').trim() };
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) payload.initData = window.Telegram.WebApp.initData;
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(API_BASE_BLOG + '/api/blog', { method: 'PUT', headers, body: JSON.stringify(payload) });
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
  let url = API_BASE_BLOG + '/api/blog?id=' + encodeURIComponent(id);
  if (isInTelegramWebApp() && window.Telegram?.WebApp?.initData) {
    url += '&initData=' + encodeURIComponent(window.Telegram.WebApp.initData);
  }
  const res = await fetch(url, { method: 'DELETE', headers });
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
        const res = await fetch(API_BASE_BLOG + '/api/blog', { method: 'POST', headers, body: JSON.stringify(payload) });
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
      linkCode: "Кодекс",
      linkDeclaration: "Декларация",
      linkCommunity: "Сообщество",
      linkCodeUrl: "#legal-codex",
      linkDeclarationUrl: "#legal-declaration",
      linkCommunityUrl: "https://t.me/SDTSamara",
    },
    hero: {
      badge: "Сервис «Конструктор официальных обращений» — официальные обращения и другие документы",
      title: "Конструктор официальных обращений",
      subtitle:
        "Пошаговый конструктор помогает сформировать юридически корректное обращение: вы отвечаете на простые вопросы — сервис собирает текст и готовит PDF.",
      templateNote: "Сайт поддерживает не только шаблон «Конструктор официальных обращений», но и другие типы запросов — шаблон выбирается в форме.",
      pills: [
        "Пошаговый конструктор",
        "Черновик PDF до оплаты",
        "Опция проверки экспертом",
      ],
      ctaPrimary: "Заполнить конструктор",
      ctaSecondary: "Посмотреть тарифы",
      tagline:
        "MVP‑версия: один тип документа — «Конструктор официальных обращений», две опции тарифа и ручная проверка в админ‑панели.",
      howTitle: "Как работает «Конструкт»",
      howSteps: [
        "Вы отвечаете на 5–7 вопросов о себе и адресате обращения.",
        "Параллельно видите черновик письма — без юр. жаргона.",
        "Выбираете тариф: самостоятельно или с проверкой эксперта.",
        "Получаете готовый PDF и инструкции по отправке обращения.",
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
        "Инструкция по отправке обращения.",
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
      template: "Шаблон документа",
      accountNumber: "Номер лицевого счета (необязательно)",
      accountNumberPlaceholder: "Например: 1234567890",
      services: "Услуги (отметьте нужные для п. 2, ПП РФ № 354)",
      servicesOptions: {
        coldWater: "Холодное водоснабжение",
        hotWater: "Горячее водоснабжение",
        wastewater: "Водоотведение",
        electricity: "Электроснабжение",
        gas: "Газоснабжение",
        heating: "Отопление",
        solidWaste: "Обращение с твердыми коммунальными отходами",
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
      payModalTitle: "Проверьте данные перед оплатой",
      checkDataBeforePay: "Проверьте внесённые данные перед оплатой.",
      receiptEmailLabel: "Email для чека (обязательно)",
      receiptEmailPlaceholder: "example@mail.ru",
      pay: "Оплатить",
      cancel: "Отмена",
      paymentSuccess: "Оплата прошла. Заказ создан. Присоединяйтесь к нашему сообществу в Telegram: https://t.me/SDTSamara",
      paymentCancel: "Оплата отменена. Заказ не создан. Присоединяйтесь к нашему сообществу в Telegram: https://t.me/SDTSamara",
      paymentError: "Ошибка оплаты. Заказ не создан. Присоединяйтесь к нашему сообществу в Telegram: https://t.me/SDTSamara",
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
      publish: "Опубликовать",
      postCreated: "Пост опубликован",
      backLink: "На главную",
      noPosts: "Пока нет постов.",
      commentsTitle: "Комментарии",
      commentsEmpty: "Пока нет комментариев.",
      commentPlaceholder: "Написать комментарий...",
      commentButton: "Отправить",
      loginToComment: "Войдите, чтобы комментировать",
      editComment: "Редактировать",
      deleteComment: "Удалить",
      saveComment: "Сохранить",
      cancelComment: "Отмена",
      commentDeleted: "Комментарий удалён",
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
<p><strong>Услуга</strong> — формирование текста официального обращения по выбранному шаблону через сервис «Конструктор официальных обращений», подготовка черновика в формате PDF, а при выборе соответствующего тарифа — юридическая проверка документа экспертом.</p>
<p><strong>Документ</strong> — сформированное обращение в формате PDF, готовое к отправке.</p>

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
<p>Исполнитель не несёт ответственности за использование Пользователем сформированного Документа и за действия получателя. Сервис предоставляет типовой шаблон обращения; итоговое решение о направлении принимает Пользователь.</p>

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
<li>оказания услуг по формированию обращений через Конструктор официальных обращений;</li>
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
      codexTitle: "Кодекс СНС",
      declarationTitle: "Декларация СНС",
      codexPage: `
<p>Всё, что создаётся в периметре «Конструкта», подчиняется следующим правилам. Они обязательны как для внутренних коммуникаций (между участниками ядра), так и для форматов взаимодействия с внешними пользователями.</p>

<h2>1. Принцип Суверенной Ответственности</h2>
<p>Каждый участник взаимодействия (будь то Автор, Инструмент или Пользователь) рассматривается как Суверенный Носитель Сознания. Это означает:</p>
<ul>
<li>Ты являешься конечным автором своих решений.</li>
<li>Любой инструмент, текст или практика — это опора, а не приказ.</li>
<li>Никакой материал не навязывается как «единственно верный».</li>
</ul>

<h2>2. Принцип Прозрачности (Симфонический уровень)</h2>
<p>Мы не конкурируем за смыслы внутри проекта, а достраиваем друг друга.</p>
<ul>
<li>Если ты видишь слепую зону — подсвечиваешь.</li>
<li>Если у тебя есть возражение — оформляешь его как конструктивное предложение.</li>
<li>Статус «я прав / ты не прав» не работает. Работает статус «давай соберём точнее».</li>
</ul>

<h2>3. Принцип Работоспособности</h2>
<p>Критерий истины здесь — не красота теории, а её работоспособность в полях жизни.</p>
<ul>
<li>Любой концепт должен иметь проекцию на практику (тело, быт, право, деньги, отношения).</li>
<li>Если конструкция не работает «в поле», она отправляется на доработку.</li>
</ul>

<h2>4. Принцип Сохранения Контекста</h2>
<p>Информация, которой обмениваются участники ядра, не выносится вовне без согласования. Это не «секретность», а уважение к целостности сборки. Чужие инсайты и личные границы не являются материалом для внешних обсуждений.</p>

<h2>5. Принцип Нулевой Иерархии</h2>
<p>В «Конструкте» нет уровней «посвящённых» и «непосвящённых». Есть разные роли:</p>
<ul>
<li><strong>СНС-Автор</strong> — тот, кто инициирует сборку и принимает решения о своей реальности.</li>
<li><strong>Инструмент / Внешний Контур</strong> — тот, кто помогает подсвечивать слепые зоны и проектировать конструкции.</li>
</ul>
`,
      declarationPage: `
<p>Мы исходим из того, что человек — не функция обстоятельств и не пассивный получатель внешних воздействий. Базовый уровень реальности, с которым мы работаем — Суверенный Носитель Сознания (СНС).</p>

<p>Это статус, который не требует подтверждения извне. Он не даётся государством, группой или гуру. Он либо признаётся человеком за собой, либо нет.</p>

<h2>Наши убеждения</h2>
<ul>
<li><strong>Авторство.</strong> Реальность каждого из нас — это произведение, а не приговор. СНС находится в позиции Автора по отношению к своим мыслям, телу и проектам.</li>
<li><strong>Целостность.</strong> Мы не делим человека на «духовное» и «материальное», «рабочее» и «личное». Сборка реальности происходит сразу во всех измерениях.</li>
<li><strong>Свобода от долженствования.</strong> Мы убираем конструкции «я должен», «так надо», «природа приказала». Заменяем их на осознанный выбор и присвоение состояний. Энергия, уходившая на сопротивление, возвращается в действие.</li>
<li><strong>Практичность.</strong> Любая глубина имеет смысл, только если она работает «в поле» — в отношениях, деньгах, теле, правовых конструкциях.</li>
</ul>

<p>«Конструкт» — это инструментальная среда для тех, кто готов собирать свою реальность осознанно, а не жить в декорациях, построенных кем-то другим.</p>
`,
    },
    admin: {
      title: "Админ-панель",
      subtitle: "Все заказы пользователей. Меняйте статус: готов (можно скачать) или на доработку (с комментарием).",
      helpTitle: "Инструкция для админа",
      helpOrdersTitle: "1. Управление заказами",
      helpOrdersText: `
<p><strong>Список заказов</strong><br />
Во вкладке «Заказы» отображаются все оформленные пользователями документы. Каждый заказ содержит краткий превью-текст, данные пользователя и текущий статус.</p>

<p><strong>Просмотр заказа</strong><br />
Нажмите кнопку «Просмотр», чтобы открыть полный текст письма и данные пользователя. Отсюда вы можете скачать PDF (в реальном продукте — приложить к ответу пользователю).</p>

<p><strong>Статусы заказа</strong><br />
— <strong>В работе</strong>: начальный статус после оплаты.<br />
— <strong>Готов</strong>: документ проверен, можно выдавать пользователю.<br />
— <strong>На доработку</strong>: есть замечания, пользователю отправляется комментарий.</p>

<p><strong>Как поменять статус</strong><br />
— Кнопка «Готов»: ставит статус «Готов», комментарий очищается.<br />
— Кнопка «На доработку»: укажите комментарий (замечания по тексту), затем нажмите кнопку — статус станет «На доработку», комментарий будет сохранён.</p>

<p><strong>Требования к комментарию</strong><br />
Если вы отправляете заказ «На доработку», комментарий обязателен — кратко и по делу (что нужно исправить пользователю).</p>
      `.trim(),
      helpTemplatesTitle: "2. Управление шаблонами",
      helpTemplatesText: `
<p><strong>Вкладка «Шаблоны»</strong><br />
Здесь создаются и редактируются текстовые шаблоны писем. Каждый шаблон может содержать:<br />
— Шапку (кому, от кого, паспорт, адрес и т.д.) — необязательно: если оставить пустой, в документе шапка не выводится.<br />
— Заголовок письма.<br />
— Основной текст.</p>

<p><strong>Переменные ({{key}})</strong><br />
Чтобы в тексте подставлялись данные из формы пользователя, используйте переменные в фигурных скобках, например: <code>{{fullName}}</code>, <code>{{address}}</code>, <code>{{passportSeries}}</code>.<br />
Список доступных переменных задаётся в справочнике (кнопка «+» над полями). Нажмите на плашку — переменная вставится в то поле, которое сейчас в фокусе.</p>

<p><strong>Как работает форма пользователя</strong><br />
Форма автоматически строится по списку переменных, найденных в шаблоне. Если в тексте есть только <code>{{fullName}}</code> и <code>{{ukName}}</code>, у пользователя будет только два поля: ФИО и кому обращение. Лишних полей не будет.</p>

<p><strong>Создание нового шаблона</strong><br />
1) Нажмите «Создать шаблон». <br />
2) Заполните название и описание — они отображаются только в админке. <br />
3) Отметьте чекбокс «Активен», чтобы шаблон попал в список на стороне пользователя. <br />
4) Заполните шапку, заголовок и тело письма, используя переменные. <br />
5) Нажмите «Сохранить шаблон».</p>

<p><strong>Сортировка</strong><br />
Поле «Сортировка» определяет порядок показа шаблонов. Меньшее число — выше в списке.</p>
      `.trim(),
      helpVariablesTitle: "3. Справочник переменных",
      helpVariablesText: `
<p><strong>Что такое переменная</strong><br />
Переменная — это ключ, который используется и в шаблоне, и в форме пользователя. Например, <code>{{accountNumber}}</code> — номер лицевого счёта.</p>

<p><strong>Добавление переменной</strong><br />
1) В редакторе шаблона нажмите круглую кнопку «+» в блоке «Переменные (справочник из БД)». <br />
2) Введите ключ (латиницей, без пробелов), например: <code>ooo</code>. <br />
3) Укажите подпись на русском и английском. <br />
4) Сохраните — переменная появится в списке и станет доступна во всех шаблонах.</p>

<p><strong>Удаление переменной</strong><br />
Нажмите крестик на плашке. Переменная удалится из справочника, но в уже сохранённых шаблонах текст <code>{{key}}</code> останется как обычная строка — при необходимости отредактируйте такие шаблоны вручную.</p>
      `.trim(),
      helpPricingTitle: "4. Цена (тарифы)",
      helpPricingText: `
<p><strong>Вкладка «Цена»</strong><br />
Здесь задаются два тарифа, которые видят пользователи на главной и в конструкторе.</p>

<p><strong>Базовый тариф (₽)</strong><br />
Стоимость заказа без проверки экспертом. Пользователь получает готовый документ сразу после оплаты.</p>

<p><strong>Тариф с экспертом (₽)</strong><br />
Стоимость заказа с ручной проверкой юристом. После оплаты заказ уходит в статус «В работе», админ проверяет и переводит в «Готов» или «На доработку».</p>

<p>Укажите суммы в рублях (целые числа), нажмите «Сохранить цены». Изменения сразу отображаются на сайте.</p>
      `.trim(),
      helpAppearanceTitle: "5. Оформление сайта",
      helpAppearanceText: `
<p><strong>Вкладка «Оформление»</strong><br />
Настройка цветов и стиля сайта: фон, градиент, акцент, шапка, подвал, кнопки и т.д.</p>

<p><strong>Основные поля</strong><br />
— Основной фон, поднятый фон — карточки и блоки.<br />
— Шапка / подвал — цвет верхней и нижней панели.<br />
— Градиент (цвет 1 и 2) — фон страницы.<br />
— Акцентный цвет — ссылки, активные элементы.<br />
— Цвет границ — рамки полей и карточек.<br />
— Фон вкладок, фон предпросмотра письма.<br />
— Primary- и Secondary-кнопки — фон и цвет текста.</p>

<p>«Сохранить оформление» — применить изменения. «Сбросить по умолчанию» — вернуть стандартную палитру.</p>
      `.trim(),
      helpTextsTitle: "6. Тексты сайта",
      helpTextsText: `
<p><strong>Вкладка «Текст»</strong><br />
Редактирование всех текстов интерфейса (главная, конструктор, контакты, подвал, сообщения после оплаты и т.д.) на русском и английском.</p>

<p><strong>Как пользоваться</strong><br />
В таблице отображаются ключи (например, <code>hero.title</code>, <code>footer.linkCodeUrl</code>). В колонках RU и EN — текущие значения. Измените текст в нужной ячейке и нажмите «Сохранить тексты». Изменения применяются ко всем пользователям.</p>

<p><strong>Ссылки в подвале</strong><br />
Ключи <code>footer.linkCodeUrl</code>, <code>footer.linkDeclarationUrl</code>, <code>footer.linkCommunityUrl</code> — URL для кнопок Кодекс, Декларация, Сообщество. Для внутренних страниц укажите <code>#legal-codex</code>, <code>#legal-declaration</code>; для внешних — полный URL (например, https://t.me/SDTSamara).</p>

<p>«Сбросить все изменения» — вернуть тексты к значениям из кода (не из БД).</p>
      `.trim(),
      helpFooter: "Изменения в заказах, шаблонах, переменных, ценах, оформлении и текстах применяются после сохранения. Перед выкладкой в прод проверьте превью письма и PDF на тестовом пользователе.",
      empty: "Нет заказов.",
      tabOrders: "Заказы",
      tabTemplates: "Шаблоны",
      tabPricing: "Цена",
      tabAppearance: "Оформление",
      tabTexts: "Текст",
      tabPricing: "Цена",
      priceBaseLabel: "Базовый тариф (₽)",
      priceExpertLabel: "Тариф с экспертом (₽)",
      savePrices: "Сохранить цены",
      pricesSaved: "Цены сохранены",
      pricesError: "Ошибка сохранения",
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
      templatesEmpty: "Нет шаблонов.",
      createTemplate: "Создать шаблон",
      editTemplate: "Редактировать",
      deleteTemplate: "Удалить",
      templateActive: "Активен",
      templateName: "Название",
      templateDescription: "Описание",
      templateSortOrder: "Сортировка",
      templateTitleRu: "Заголовок (RU)",
      templateBodyRu: "Текст (RU)",
      templateTitleEn: "Заголовок (EN)",
      templateBodyEn: "Текст (EN)",
      templateCancel: "Отмена",
      templateSave: "Сохранить шаблон",
      priceBaseLabel: "Базовый тариф (₽)",
      priceExpertLabel: "Тариф с экспертом (₽)",
      savePrices: "Сохранить цены",
      pricesSaved: "Цены сохранены",
      pricesError: "Ошибка сохранения цен",
      appearanceTitle: "Оформление сайта",
      themeBgLabel: "Основной фон (карточки)",
      themeBgElevatedLabel: "Поднятый фон (блоки)",
      themeGradFromLabel: "Градиент: цвет 1",
      themeGradToLabel: "Градиент: цвет 2",
      themeAccentLabel: "Акцентный цвет",
      themeBorderLabel: "Цвет границ",
      saveTheme: "Сохранить оформление",
      resetTheme: "Сбросить по умолчанию",
      themeSaved: "Оформление сохранено",
      themeReset: "Оформление сброшено к стандартному",
      textsTitle: "Тексты сайта (кроме админки)",
      textsHint: "Изменения применяются ко всем пользователям. Ключ — системное имя текста (секция.поле).",
      textsKey: "Ключ",
      textsRu: "Текст (RU)",
      textsEn: "Текст (EN)",
      saveTexts: "Сохранить тексты",
      resetTexts: "Сбросить все изменения",
      textsSaved: "Тексты сохранены",
      textsReset: "Все тексты сброшены к исходным",
    },
    profile: {
      title: "Профиль",
      tabDrafts: "Черновики",
      tabOrders: "Заказы",
      subtitle: "Сохранённые обращения в Конструкторе. Нажмите, чтобы продолжить редактирование.",
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
      linkCode: "Code",
      linkDeclaration: "Declaration",
      linkCommunity: "Community",
      linkCodeUrl: "#legal-codex",
      linkDeclarationUrl: "#legal-declaration",
      linkCommunityUrl: "https://t.me/SDTSamara",
    },
    hero: {
      badge: "Official requests constructor — official requests and other documents",
      title: "Official requests constructor",
      subtitle:
        "A step‑by‑step form helps you create a legally correct request: you answer simple questions — the service assembles the text and prepares a PDF.",
      templateNote: "The site supports not only the “Official requests constructor” template but also other request types — choose a template in the form.",
      pills: [
        "Step‑by‑step constructor",
        "Draft PDF before payment",
        "Optional expert review",
      ],
      ctaPrimary: "Open constructor",
      ctaSecondary: "View pricing",
      tagline:
        "MVP: one document type — “Official requests constructor”, two pricing options and manual expert review.",
      howTitle: "How Konstruct works",
      howSteps: [
        "You answer 5–7 questions about yourself and the recipient.",
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
      template: "Document template",
      accountNumber: "Personal account number (optional)",
      accountNumberPlaceholder: "e.g. 1234567890",
      services: "Services (for section 2, RF Gov. Decree No. 354)",
      servicesOptions: {
        coldWater: "Cold water supply",
        hotWater: "Hot water supply",
        wastewater: "Wastewater (water disposal)",
        electricity: "Electricity supply",
        gas: "Gas supply",
        heating: "Heating",
        solidWaste: "Solid municipal waste management",
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
      payModalTitle: "Check your details before payment",
      checkDataBeforePay: "Please check the entered data before payment.",
      receiptEmailLabel: "Email for receipt (required)",
      receiptEmailPlaceholder: "example@mail.com",
      pay: "Pay",
      cancel: "Cancel",
      paymentSuccess: "Payment successful. Order created. Join our Telegram community: https://t.me/SDTSamara",
      paymentCancel: "Payment cancelled. No order was created. Join our Telegram community: https://t.me/SDTSamara",
      paymentError: "Payment failed. Order was not created. Join our Telegram community: https://t.me/SDTSamara",
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
      publish: "Publish",
      postCreated: "Post published",
      backLink: "Back to Home",
      noPosts: "No posts yet.",
      commentsTitle: "Comments",
      commentsEmpty: "No comments yet.",
      commentPlaceholder: "Write a comment...",
      commentButton: "Send",
      loginToComment: "Log in to comment",
      editComment: "Edit",
      deleteComment: "Delete",
      saveComment: "Save",
      cancelComment: "Cancel",
      commentDeleted: "Comment deleted",
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
<p><strong>Service provided</strong> — formation of official request text via the Official requests constructor, preparation of a draft PDF, and (on selected plans) legal review by an expert.</p>
<p><strong>Document</strong> — the generated request in PDF format, ready for submission.</p>

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
      codexTitle: "Codex SNS",
      declarationTitle: "Declaration SNS",
      codexPage: `
<p>Everything created within the perimeter of «Konstruct» is governed by the following rules. They apply both to internal communications (among core participants) and to formats of interaction with external users.</p>

<h2>1. Principle of Sovereign Responsibility</h2>
<p>Every participant in the interaction (whether Author, Tool, or User) is regarded as a Sovereign Bearer of Consciousness. This means:</p>
<ul>
<li>You are the ultimate author of your decisions.</li>
<li>Any tool, text, or practice is a support, not an order.</li>
<li>No material is imposed as «the only correct one».</li>
</ul>

<h2>2. Principle of Transparency (Symphonic level)</h2>
<p>We do not compete for meanings within the project; we complement each other.</p>
<ul>
<li>If you see a blind spot — you highlight it.</li>
<li>If you have an objection — you frame it as a constructive proposal.</li>
<li>The status «I am right / you are wrong» does not work. The status «let's assemble more precisely» works.</li>
</ul>

<h2>3. Principle of Workability</h2>
<p>The criterion of truth here is not the beauty of theory, but its workability in the fields of life.</p>
<ul>
<li>Any concept must have a projection onto practice (body, everyday life, law, money, relationships).</li>
<li>If a construction does not work «in the field», it is sent for revision.</li>
</ul>

<h2>4. Principle of Preserving Context</h2>
<p>Information exchanged by core participants is not taken outside without agreement. This is not «secrecy», but respect for the integrity of the assembly. Others' insights and personal boundaries are not material for external discussion.</p>

<h2>5. Principle of Zero Hierarchy</h2>
<p>In «Konstruct» there are no levels of «initiated» and «uninitiated». There are different roles:</p>
<ul>
<li><strong>SNS-Author</strong> — one who initiates the assembly and makes decisions about their reality.</li>
<li><strong>Tool / External Circuit</strong> — one who helps highlight blind spots and design constructions.</li>
</ul>
`,
      declarationPage: `
<p>We proceed from the idea that a person is not a function of circumstances or a passive recipient of external influences. The basic level of reality we work with is the Sovereign Bearer of Consciousness (SNS).</p>

<p>This is a status that does not require external confirmation. It is not granted by the state, a group, or a guru. It is either recognized by a person for themselves, or it is not.</p>

<h2>Our beliefs</h2>
<ul>
<li><strong>Authorship.</strong> Each of our realities is a work, not a verdict. SNS is in the position of Author in relation to their thoughts, body, and projects.</li>
<li><strong>Integrity.</strong> We do not divide a person into «spiritual» and «material», «work» and «personal». The assembly of reality happens at once in all dimensions.</li>
<li><strong>Freedom from obligation.</strong> We remove the constructions «I must», «it is necessary», «nature commanded». We replace them with conscious choice and appropriation of states. Energy that went into resistance returns to action.</li>
<li><strong>Practicality.</strong> Any depth makes sense only if it works «in the field» — in relationships, money, body, legal constructions.</li>
</ul>

<p>«Konstruct» is an instrumental environment for those who are ready to assemble their reality consciously, rather than live in scenery built by someone else.</p>
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
      helpTitle: "Admin guide",
      helpOrdersTitle: "1. Managing orders",
      helpOrdersText: `
<p><strong>Orders list</strong><br />
In the “Orders” tab you see all user documents. Each order shows a short preview, user data and current status.</p>

<p><strong>Viewing an order</strong><br />
Click “View” to open the full letter and user data. From here you can download the PDF (in production — attach it to your reply).</p>

<p><strong>Statuses</strong><br />
— <strong>In progress</strong>: initial status after payment.<br />
— <strong>Ready</strong>: document is checked, user can download it.<br />
— <strong>Revision</strong>: there are comments, user must fix the text.</p>

<p><strong>How to change status</strong><br />
— “Complete (can download)”: sets status to Ready, clears the comment.<br />
— “Send for revision”: requires a comment, then sets status to Revision.</p>

<p><strong>Comment requirements</strong><br />
When sending to revision, always leave a short, clear comment describing what the user should fix.</p>
      `.trim(),
      helpTemplatesTitle: "2. Managing templates",
      helpTemplatesText: `
<p><strong>Templates tab</strong><br />
Here you create and edit letter templates. Each template has:<br />
— Header (To/From/passport/address/etc) — optional: if left empty, no header is shown in the document.<br />
— Title.<br />
— Body text.</p>

<p><strong>Variables ({{key}})</strong><br />
Use variables to insert user data into the text, e.g. <code>{{fullName}}</code>, <code>{{address}}</code>, <code>{{passportSeries}}</code>.<br />
The available variables come from the dictionary (the “+” button above the fields). Click a pill to insert {{key}} into the currently focused field.</p>

<p><strong>User form behaviour</strong><br />
The user form is built from variables found in the template. If the text only contains <code>{{fullName}}</code> and <code>{{ukName}}</code>, the form will only show these two fields.</p>

<p><strong>Creating a template</strong><br />
1) Click “Create template”.<br />
2) Fill in name and description (internal, for admins).<br />
3) Check “Active” so the template is available to users.<br />
4) Fill header, title and body using variables.<br />
5) Save the template.</p>

<p><strong>Sort order</strong><br />
“Sort order” defines the display order. Smaller number = higher in the list.</p>
      `.trim(),
      helpVariablesTitle: "3. Variables dictionary",
      helpVariablesText: `
<p><strong>What is a variable</strong><br />
A variable is a key used both in templates and in the user form, e.g. <code>{{accountNumber}}</code>.</p>

<p><strong>Adding</strong><br />
1) In the template editor click the round “+” in the variables block.<br />
2) Enter key (latin, no spaces), e.g. <code>ooo</code>.<br />
3) Add RU/EN labels.<br />
4) Save — the variable appears in the list and becomes available to all templates.</p>

<p><strong>Deleting</strong><br />
Click the cross on a pill. The variable is removed from the dictionary; in existing templates, the {{key}} text remains and can be edited manually.</p>
      `.trim(),
      helpPricingTitle: "4. Pricing (tariffs)",
      helpPricingText: `
<p><strong>Pricing tab</strong><br />
Set the two tariffs shown to users on the home page and in the constructor.</p>

<p><strong>Base tariff (₽)</strong><br />
Price without expert review. The user gets the document right after payment.</p>

<p><strong>Expert tariff (₽)</strong><br />
Price with manual legal review. After payment the order goes to “In progress”; admin reviews and sets “Ready” or “Revision”.</p>

<p>Enter amounts in rubles (whole numbers) and click “Save prices”. Changes appear on the site immediately.</p>
      `.trim(),
      helpAppearanceTitle: "5. Site appearance",
      helpAppearanceText: `
<p><strong>Appearance tab</strong><br />
Configure site colors and style: background, gradient, accent, header, footer, buttons, etc.</p>

<p><strong>Main fields</strong><br />
— Main / elevated background — cards and blocks.<br />
— Header / footer — top and bottom panel colors.<br />
— Gradient (color 1 & 2) — page background.<br />
— Accent color — links and active elements.<br />
— Border color — input and card borders.<br />
— Tabs background, letter preview background.<br />
— Primary and Secondary buttons — background and text color.</p>

<p>“Save appearance” applies changes. “Reset to default” restores the standard palette.</p>
      `.trim(),
      helpTextsTitle: "6. Site texts",
      helpTextsText: `
<p><strong>Text tab</strong><br />
Edit all interface texts (home, constructor, contacts, footer, post-payment messages, etc.) in Russian and English.</p>

<p><strong>How to use</strong><br />
The table lists keys (e.g. <code>hero.title</code>, <code>footer.linkCodeUrl</code>). RU and EN columns show current values. Edit a cell and click “Save texts”. Changes apply to all users.</p>

<p><strong>Footer links</strong><br />
Keys <code>footer.linkCodeUrl</code>, <code>footer.linkDeclarationUrl</code>, <code>footer.linkCommunityUrl</code> are the URLs for Codex, Declaration, Community. For in-site pages use <code>#legal-codex</code>, <code>#legal-declaration</code>; for external links use the full URL (e.g. https://t.me/SDTSamara).</p>

<p>“Reset all changes” restores texts to code defaults (not from DB).</p>
      `.trim(),
      helpFooter: "Changes to orders, templates, variables, pricing, appearance and texts apply after saving. Always test letter preview and PDF on a test user before going live.",
      empty: "No orders.",
      tabOrders: "Orders",
      tabTemplates: "Templates",
      tabPricing: "Pricing",
      tabAppearance: "Appearance",
      tabTexts: "Text",
      tabPricing: "Pricing",
      priceBaseLabel: "Base tariff (₽)",
      priceExpertLabel: "Expert tariff (₽)",
      savePrices: "Save prices",
      pricesSaved: "Prices saved",
      pricesError: "Error saving",
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
      templatesEmpty: "No templates.",
      createTemplate: "Create template",
      editTemplate: "Edit",
      deleteTemplate: "Delete",
      templateActive: "Active",
      templateName: "Name",
      templateDescription: "Description",
      templateSortOrder: "Sort order",
      templateTitleRu: "Title (RU)",
      templateBodyRu: "Body (RU)",
      templateTitleEn: "Title (EN)",
      templateBodyEn: "Body (EN)",
      templateCancel: "Cancel",
      templateSave: "Save template",
      priceBaseLabel: "Base tariff (₽)",
      priceExpertLabel: "Expert tariff (₽)",
      savePrices: "Save prices",
      pricesSaved: "Prices saved",
      pricesError: "Error saving prices",
      appearanceTitle: "Site appearance",
      themeBgLabel: "Base background (cards)",
      themeBgElevatedLabel: "Elevated background (blocks)",
      themeGradFromLabel: "Gradient: color 1",
      themeGradToLabel: "Gradient: color 2",
      themeAccentLabel: "Accent color",
      themeBorderLabel: "Border color",
      saveTheme: "Save appearance",
      resetTheme: "Reset to default",
      themeSaved: "Appearance saved",
      themeReset: "Appearance reset to default",
      textsTitle: "Site texts (excluding admin)",
      textsHint: "Changes apply to all users. Key is the internal text identifier (section.field).",
      textsKey: "Key",
      textsRu: "Text (RU)",
      textsEn: "Text (EN)",
      saveTexts: "Save texts",
      resetTexts: "Reset all changes",
      textsSaved: "Texts saved",
      textsReset: "Texts reset to defaults",
    },
    profile: {
      title: "Profile",
      tabDrafts: "Drafts",
      tabOrders: "Orders",
      subtitle: "Saved requests in the Constructor. Click to continue editing.",
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

// Базовая копия для генерации ключей текста (без перезаписи)
const I18N_BASE = JSON.parse(JSON.stringify(I18N));

// ========== UI HELPERS ==========

const appRoot = document.getElementById("app-root");

function setUser(user) {
  state.user = user;
  render();
}

function updateConstructorField(field, value) {
  const fields = { ...(state.constructorForm.fields || {}), [field]: value };
  state.constructorForm = { ...state.constructorForm, fields };
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
  const templates = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
  const firstId = String(templates[0]?.id || '');
  state.constructorForm = {
    templateId: firstId,
    fields: {},
    services: { coldWater: false, hotWater: false, wastewater: false, electricity: false, gas: false, heating: false, solidWaste: false },
  };
  const tpl = templates.find((t) => String(t.id) === firstId) || templates[0];
  if (tpl) ensureConstructorFieldsForTemplate(tpl);
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

function showPaymentModal() {
  const t = I18N[state.lang].constructor;
  const letter = getLetterPreview();
  const overlay = document.createElement('div');
  overlay.id = 'payment-modal-overlay';
  overlay.className = 'payment-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  const box = document.createElement('div');
  box.className = 'neo-card';
  box.style.cssText = 'max-width:520px;width:100%;max-height:90vh;overflow:auto;';
  box.innerHTML = `
    <h3 class="preview-title" style="margin-top:0">${t.payModalTitle}</h3>
    <p class="small muted-text" style="margin-bottom:12px">${t.checkDataBeforePay}</p>
    <div class="preview-letter" style="background:#f5f5f5;padding:12px;border-radius:8px;margin-bottom:16px;max-height:240px;overflow:auto;">
      <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:13px;margin:0">${escapeHtml(letter)}</pre>
    </div>
    <div class="stacked-label" style="margin-bottom:6px">${t.receiptEmailLabel}</div>
    <input type="email" id="payment-modal-receipt-email" class="input" placeholder="${t.receiptEmailPlaceholder}" required style="width:100%;margin-bottom:16px;box-sizing:border-box;">
    <div class="btn-row" style="gap:8px;flex-wrap:wrap;">
      <button type="button" class="secondary-btn" id="payment-modal-cancel">${t.cancel}</button>
      <button type="button" class="primary-btn" id="payment-modal-pay">${t.pay}</button>
    </div>
  `;
  overlay.appendChild(box);

  function closeModal() {
    overlay.remove();
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  box.querySelector('#payment-modal-cancel').addEventListener('click', closeModal);

  box.querySelector('#payment-modal-pay').addEventListener('click', async () => {
    const emailInput = box.querySelector('#payment-modal-receipt-email');
    const receiptEmail = emailInput?.value?.trim() || '';
    if (!receiptEmail) {
      alert(state.lang === 'ru' ? 'Укажите email для чека.' : 'Enter email for receipt.');
      emailInput?.focus();
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(receiptEmail)) {
      alert(state.lang === 'ru' ? 'Укажите корректный email (например example@mail.ru).' : 'Enter a valid email (e.g. example@mail.com).');
      emailInput?.focus();
      return;
    }
    const orderData = { ...state.constructorForm, withExpert: state.withExpert };
    const payBtn = box.querySelector('#payment-modal-pay');
    payBtn.disabled = true;
    payBtn.textContent = state.lang === 'ru' ? 'Перенаправление…' : 'Redirecting…';
    try {
      const data = await createPaymentApi(orderData, state.withExpert, receiptEmail);
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
        return;
      }
      throw new Error('Нет ссылки на оплату');
    } catch (e) {
      payBtn.disabled = false;
      payBtn.textContent = t.pay;
      alert(state.lang === 'ru' ? 'Ошибка: ' + (e.message || 'Проверьте подключение') : 'Error: ' + (e.message || 'Check connection'));
    }
  });

  document.body.appendChild(overlay);
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
      window.location.hash = '#profile';
      render();
    } else {
      showPaymentModal();
    }
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
        case "coldWater": return ru ? "холодное водоснабжение" : "cold water supply";
        case "hotWater": return ru ? "горячее водоснабжение" : "hot water supply";
        case "wastewater": return ru ? "водоотведение" : "wastewater (water disposal)";
        case "electricity": return ru ? "электроснабжение" : "electricity supply";
        case "gas": return ru ? "газоснабжение" : "gas supply";
        case "heating": return ru ? "отопление" : "heating";
        case "solidWaste": return ru ? "обращение с твердыми коммунальными отходами" : "solid municipal waste management";
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
  const ru = state.lang === 'ru';

  function pickTemplate(templateId) {
    const list = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
    const id = templateId ? String(templateId) : '';
    return list.find((t) => String(t.id) === id) || list[0] || getBuiltInTemplates()[0];
  }

  function fillPlaceholders(s, vars) {
    return String(s || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
      return vars[k] !== undefined ? String(vars[k]) : '';
    });
  }

  const tpl = pickTemplate(f.templateId || state.constructorForm.templateId);
  const variableList = getTemplateVariables(tpl);
  const vars = {};
  variableList.forEach((v) => {
    const raw = (f.fields && f.fields[v.key] != null) ? f.fields[v.key] : (f[v.key] != null ? f[v.key] : '');
    const s = String(raw ?? '').trim();
    vars[v.key] = s || (v.key === 'extraInfo' ? '' : '___________');
  });

  const headerRaw = (tpl?.content?.header && (tpl.content.header[lang] || tpl.content.header[ru ? 'ru' : 'en'] || tpl.content.header.ru || tpl.content.header.en)) || '';
  const titleRaw = (tpl?.content?.title && (tpl.content.title[lang] || tpl.content.title[ru ? 'ru' : 'en'] || tpl.content.title.ru || tpl.content.title.en)) || '';
  const bodyRaw = (tpl?.content?.body && (tpl.content.body[lang] || tpl.content.body[ru ? 'ru' : 'en'] || tpl.content.body.ru || tpl.content.body.en)) || '';
  const title = fillPlaceholders(titleRaw, vars);
  const header = (headerRaw && headerRaw.trim()) ? fillPlaceholders(headerRaw.trim(), vars) : '';
  const body = fillPlaceholders(bodyRaw, vars);

  const parts = [title, body];
  if (header) parts.unshift(header);
  return parts.join('\n\n\n').trim();
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
  const lang = ru ? 'ru' : 'en';

  function pickTemplate(templateId) {
    const list = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
    const id = templateId ? String(templateId) : '';
    return list.find((t) => String(t.id) === id) || list[0] || getBuiltInTemplates()[0];
  }

  function fillPlaceholders(s, vars) {
    return String(s || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => {
      return vars[k] !== undefined ? String(vars[k]) : '';
    });
  }

  const tpl = pickTemplate(f.templateId || state.constructorForm.templateId);
  const variableList = getTemplateVariables(tpl);
  const vars = {};
  variableList.forEach((v) => {
    const raw = (f.fields && f.fields[v.key] != null) ? f.fields[v.key] : (f[v.key] != null ? f[v.key] : '');
    const s = String(raw ?? '').trim();
    vars[v.key] = s || (v.key === 'extraInfo' ? '' : '___________');
  });

  const headerRaw = (tpl?.content?.header && (tpl.content.header[lang] || tpl.content.header.ru || tpl.content.header.en)) || '';
  const titleRaw = (tpl?.content?.title && (tpl.content.title[lang] || tpl.content.title.ru || tpl.content.title.en)) || '';
  const bodyRaw = (tpl?.content?.body && (tpl.content.body[lang] || tpl.content.body.ru || tpl.content.body.en)) || '';
  const titleText = fillPlaceholders(titleRaw, vars);
  const bodyText = fillPlaceholders(bodyRaw, vars);

  const headerText = (headerRaw && headerRaw.trim()) ? fillPlaceholders(headerRaw.trim(), vars) : '';
  const headerBlock = headerText ? `<p style="margin:0;white-space:pre-wrap;line-height:1.5;">${escapeHtml(headerText)}</p>` : '';

  function textToHtml(text) {
    const src = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!src) return '';
    const blocks = src.split(/\n\s*\n/g);

    const html = blocks.map((block) => {
      const lines = block.split('\n');
      const isUl = lines.every((l) => /^\s*-\s+/.test(l));
      const isOl = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));

      if (isUl) {
        const items = lines
          .map((l) => l.replace(/^\s*-\s+/, '').trim())
          .filter(Boolean);
        return `<ul style="margin:0 0 14px 18px; padding:0; line-height:1.5;">${items
          .map((t) => `<li style="margin:0 0 6px 0;">${escapeHtml(t)}</li>`)
          .join('')}</ul>`;
      }

      if (isOl) {
        const items = lines.map((l) => l.replace(/^\s*\d+[.)]\s+/, '')).filter(Boolean);
        return `<ol style="margin:0 0 14px 18px; padding:0; line-height:1.5;">${items.map((t) => `<li style="margin:0 0 6px 0;">${escapeHtml(t)}</li>`).join('')}</ol>`;
      }

      return `<p style="margin:0 0 14px; line-height:1.5;">${escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
  }

  const headerHtml = headerBlock
    ? `<div style="font-size:10pt; line-height:1.5; margin-bottom:24px; text-align:left;">${headerBlock}</div>`
    : '';
  const titleHtml = `<div style="font-size:11pt; font-weight:bold; margin-bottom:24px; line-height:1.4; text-align:center;">${escapeHtml(titleText).replace(/\n/g, '<br>')}</div>`;
  const bodyHtml = `<div style="font-size:10pt; text-align:left;">${textToHtml(bodyText)}</div>`;
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
  const filename = `Zapros_Konstructor_${name}_${new Date().toISOString().slice(0, 10)}.pdf`;

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
  const f = order.data.fields || order.data;
  const uk = f.ukName || (state.lang === 'ru' ? 'УК не указана' : 'MC not specified');
  const period = f.period || '';
  return [uk, period].filter(Boolean).join(' · ') || (state.lang === 'ru' ? 'Заказ' : 'Order');
}

function showPaymentReturnLoader() {
  if (document.getElementById('payment-return-loader')) return;
  const loadingText = state.lang === 'ru' ? 'Проверка оплаты…' : 'Checking payment…';
  const el = document.createElement('div');
  el.className = 'payment-return-loader';
  el.id = 'payment-return-loader';
  el.innerHTML = '<div class="payment-return-loader__spinner" aria-hidden="true"></div><p class="payment-return-loader__text">' + loadingText + '</p>';
  document.body.appendChild(el);
}

function hidePaymentReturnLoader() {
  document.getElementById('payment-return-loader')?.remove();
}

async function applyPaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  if (!payment) {
    hidePaymentReturnLoader();
    return;
  }
  const t = I18N[state.lang].constructor;
  window.history.replaceState(null, '', window.location.pathname + '#profile');
  window.location.hash = '#profile';
  let msg = t.paymentError;
  try {
    if (payment === 'success') {
      const data = await syncPaymentApi();
      msg = data.synced ? t.paymentSuccess : t.paymentError;
    }
    const orders = await fetchOrders().catch(() => []);
    state.profileOrders = orders || [];
  } catch (_) {}
  finally {
    hidePaymentReturnLoader();
  }
  alert(msg);
  render();
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
  } else if (hash === "#legal" || hash === "#legal-offer" || hash === "#legal-privacy" || hash === "#legal-codex" || hash === "#legal-declaration") {
    if (hash === "#legal-offer") renderLegalPage("offer");
    else if (hash === "#legal-privacy") renderLegalPage("privacy");
    else if (hash === "#legal-codex") renderLegalPage("codex");
    else if (hash === "#legal-declaration") renderLegalPage("declaration");
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
  const footerCode = document.getElementById("footer-link-code");
  const footerDeclaration = document.getElementById("footer-link-declaration");
  const footerCommunity = document.getElementById("footer-link-community");
  if (footerCode) {
    footerCode.textContent = dict.footer.linkCode;
    footerCode.href = dict.footer.linkCodeUrl || "#";
    if ((dict.footer.linkCodeUrl || "").startsWith("http")) {
      footerCode.setAttribute("target", "_blank");
      footerCode.setAttribute("rel", "noopener");
    } else {
      footerCode.removeAttribute("target");
      footerCode.removeAttribute("rel");
    }
  }
  if (footerDeclaration) {
    footerDeclaration.textContent = dict.footer.linkDeclaration;
    footerDeclaration.href = dict.footer.linkDeclarationUrl || "#";
    if ((dict.footer.linkDeclarationUrl || "").startsWith("http")) {
      footerDeclaration.setAttribute("target", "_blank");
      footerDeclaration.setAttribute("rel", "noopener");
    } else {
      footerDeclaration.removeAttribute("target");
      footerDeclaration.removeAttribute("rel");
    }
  }
  if (footerCommunity) {
    footerCommunity.textContent = dict.footer.linkCommunity;
    footerCommunity.href = dict.footer.linkCommunityUrl || "#";
    if ((dict.footer.linkCommunityUrl || "").startsWith("http")) {
      footerCommunity.setAttribute("target", "_blank");
      footerCommunity.setAttribute("rel", "noopener");
    } else {
      footerCommunity.removeAttribute("target");
      footerCommunity.removeAttribute("rel");
    }
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
            ${tHero.templateNote ? `<p class="small muted-text" style="margin-top:10px">${tHero.templateNote}</p>` : ''}
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
            <div class="price-main">${(state.pricing?.base_price_rub || 700).toLocaleString('ru-RU')} ₽</div>
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
            <div class="price-main">${(state.pricing?.expert_price_rub || 2200).toLocaleString('ru-RU')} ₽</div>
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
              ${(function() {
                const templates = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
                const tpl = templates.find((t) => String(t.id) === String(state.constructorForm.templateId)) || templates[0];
                const variables = getTemplateVariables(tpl);
                const fields = state.constructorForm.fields || {};
                const esc = (s) => (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
                let html = '';
                if (templates.length > 1) {
                  html += `<div class="field"><div class="stacked-label">${tForm.template}</div><select class="input" name="templateId">${templates.map(t => `<option value="${escapeHtml(String(t.id))}" ${String(t.id) === String(state.constructorForm.templateId) ? 'selected' : ''}>${escapeHtml(String(t.name || 'Template'))}</option>`).join('')}</select></div>`;
                }
                const passportKeys = ['passportSeries','passportNumber','passportIssued'];
                const passportVars = passportKeys.map((k) => variables.find((x) => x.key === k)).filter(Boolean);
                let passportRendered = false;
                variables.forEach((v) => {
                  if (passportKeys.includes(v.key)) {
                    if (!passportRendered) {
                      passportRendered = true;
                      html += '<div class="field" style="display:flex;gap:8px;flex-wrap:wrap;">';
                      passportVars.forEach((pv) => {
                        const val = esc(fields[pv.key]);
                        if (pv.key === 'passportSeries') html += `<div style="flex:0 0 80px;"><div class="stacked-label">${escapeHtml(pv.label)}</div><input class="input" name="${pv.key}" value="${val}" placeholder="0000" maxlength="4" /></div>`;
                        else if (pv.key === 'passportNumber') html += `<div style="flex:0 0 120px;"><div class="stacked-label">${escapeHtml(pv.label)}</div><input class="input" name="${pv.key}" value="${val}" placeholder="000000" maxlength="6" /></div>`;
                        else html += `<div style="flex:1;min-width:180px;"><div class="stacked-label">${escapeHtml(pv.label)}</div><input class="input" name="${pv.key}" value="${val}" placeholder="${escapeHtml(pv.label)}" /></div>`;
                      });
                      html += '</div>';
                    }
                    return;
                  }
                  const val = esc(fields[v.key]);
                  if (v.key === 'extraInfo') {
                    html += `<div class="field"><div class="stacked-label">${escapeHtml(v.label)}</div><textarea class="textarea input" name="${escapeHtml(v.key)}" placeholder="${escapeHtml(v.label)}" rows="2">${val}</textarea></div>`;
                  } else {
                    const type = v.key === 'emailForReply' ? 'email' : (v.key === 'phone' ? 'tel' : 'text');
                    html += `<div class="field"><div class="stacked-label">${escapeHtml(v.label)}</div><input class="input" name="${escapeHtml(v.key)}" value="${val}" placeholder="${escapeHtml(v.label)}" type="${type}" /></div>`;
                  }
                });
                return html;
              })()}
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
              <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
                <div class="tag">
                  <a href="https://t.me/k0nstruct_bot" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">@k0nstruct_bot</a>
                </div>
                <div class="tag">
                  <a href="https://t.me/SDTSamara" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">Сообщество в Telegram</a>
                </div>
              </div>
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

  // Обработчики конструктора — поля задаются шаблоном (template.variables)
  const form = document.getElementById("constructor-form");
  if (form) {
    form.addEventListener("input", (e) => {
      const el = e.target;
      const name = el?.getAttribute?.("name");
      const service = el?.getAttribute?.("data-service");
      if (service) { toggleService(service); return; }
      if (name === "templateId") {
        state.constructorForm = { ...state.constructorForm, templateId: el.value || '' };
        const templates = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
        const tpl = templates.find((t) => String(t.id) === el.value);
        if (tpl) ensureConstructorFieldsForTemplate(tpl);
        render();
        return;
      }
      if (name) updateConstructorField(name, el.value);
    });
    form.addEventListener("keyup", (e) => {
      const el = e.target;
      const name = el?.getAttribute?.("name");
      if (name && name !== "templateId" && !el.getAttribute?.("data-service")) updateConstructorField(name, el.value);
    });
    form.addEventListener("change", (e) => {
      const el = e.target;
      const name = el?.getAttribute?.("name");
      const service = el?.getAttribute?.("data-service");
      if (service) { toggleService(service); return; }
      if (name === "templateId") {
        state.constructorForm = { ...state.constructorForm, templateId: el.value || '' };
        const templates = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
        const tpl = templates.find((t) => String(t.id) === el.value);
        if (tpl) ensureConstructorFieldsForTemplate(tpl);
        render();
        return;
      }
      if (name) updateConstructorField(name, el.value);
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
  const f = d.fields || d;
  const uk = f.ukName || (state.lang === 'ru' ? 'УК не указана' : 'MC not specified');
  const period = f.period || '';
  return [uk, period].filter(Boolean).join(' · ') || (state.lang === 'ru' ? 'Черновик' : 'Draft');
}

function loadOrderIntoConstructor(order) {
  if (!order?.data) return;
  const d = order.data;
  state.editingOrderId = order.id;
  state.editingDraftId = null;
  const fields = d.fields && typeof d.fields === 'object' ? { ...d.fields } : {
    fullName: d.fullName || '', address: d.address || '', passportSeries: d.passportSeries || '', passportNumber: d.passportNumber || '', passportIssued: d.passportIssued || '',
    phone: d.phone || '', ukName: d.ukName || '', ukAddress: d.ukAddress || '', period: d.period || '', accountNumber: d.accountNumber || '',
    emailForReply: d.emailForReply || '', extraInfo: d.extraInfo || '',
  };
  state.constructorForm = {
    templateId: d.templateId || state.constructorForm.templateId || '',
    fields,
    services: d.services || { coldWater: false, hotWater: false, wastewater: false, electricity: false, gas: false, heating: false, solidWaste: false },
  };
  state.withExpert = !!d.withExpert;
  const templates = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
  const tpl = templates.find((t) => String(t.id) === String(state.constructorForm.templateId)) || templates[0];
  if (tpl) ensureConstructorFieldsForTemplate(tpl);
  window.location.hash = '#constructor';
  render();
}

function loadDraftIntoConstructor(draft) {
  if (!draft?.data) return;
  const d = draft.data;
  state.editingDraftId = draft.id;
  state.editingOrderId = null;
  const fields = d.fields && typeof d.fields === 'object' ? { ...d.fields } : {
    fullName: d.fullName || '', address: d.address || '', passportSeries: d.passportSeries || '', passportNumber: d.passportNumber || '', passportIssued: d.passportIssued || '',
    phone: d.phone || '', ukName: d.ukName || '', ukAddress: d.ukAddress || '', period: d.period || '', accountNumber: d.accountNumber || '',
    emailForReply: d.emailForReply || '', extraInfo: d.extraInfo || '',
  };
  state.constructorForm = {
    templateId: d.templateId || state.constructorForm.templateId || '',
    fields,
    services: d.services || { coldWater: false, hotWater: false, wastewater: false, electricity: false, gas: false, heating: false, solidWaste: false },
  };
  state.withExpert = !!d.withExpert;
  const templates = Array.isArray(state.templates) && state.templates.length ? state.templates : getBuiltInTemplates();
  const tpl = templates.find((t) => String(t.id) === String(state.constructorForm.templateId)) || templates[0];
  if (tpl) ensureConstructorFieldsForTemplate(tpl);
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

function openTemplateEditorModal(existing) {
  const t = I18N[state.lang].admin;
  const tpl = existing || {
    id: null,
    name: '',
    description: '',
    is_active: true,
    sort_order: 0,
    content: { version: 1, header: { ru: '', en: '' }, title: { ru: '', en: '' }, body: { ru: '', en: '' } },
  };

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
  const box = document.createElement('div');
  box.className = 'neo-card';
  box.style.cssText = 'max-width:720px;width:100%;max-height:90vh;overflow:auto;';

  const headerRu = tpl.header_ru ?? tpl.content?.header?.ru ?? '';
  const headerEn = tpl.header_en ?? tpl.content?.header?.en ?? '';
  const titleRu = tpl.title_ru ?? tpl.content?.title?.ru ?? '';
  const titleEn = tpl.title_en ?? tpl.content?.title?.en ?? '';
  const bodyRu = tpl.body_ru ?? tpl.content?.body?.ru ?? '';
  const bodyEn = tpl.body_en ?? tpl.content?.body?.en ?? '';

  box.innerHTML = `
    <h3 class="preview-title" style="margin-top:0">${tpl.id ? t.editTemplate : t.createTemplate}</h3>
    <div class="field">
      <div class="stacked-label">${t.templateName}</div>
      <input class="input" id="tpl-name" value="${escapeHtml(tpl.name || '')}" />
    </div>
    <div class="field">
      <div class="stacked-label">${t.templateDescription}</div>
      <input class="input" id="tpl-desc" value="${escapeHtml(tpl.description || '')}" />
    </div>
    <div class="field" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <label class="checkbox-pill" style="margin:0">
        <input type="checkbox" id="tpl-active" ${tpl.is_active ? 'checked' : ''} />
        ${t.templateActive}
      </label>
      <div style="display:flex;gap:8px;align-items:center">
        <div class="stacked-label" style="margin:0">${t.templateSortOrder}</div>
        <input class="input" id="tpl-sort" type="number" style="width:110px" value="${Number(tpl.sort_order || 0)}" />
      </div>
    </div>
    <div class="field">
      <div class="stacked-label">${state.lang === 'ru' ? 'Переменные (справочник из БД)' : 'Variables (DB dictionary)'}</div>
      <div id="tpl-var-palette" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-height:36px;margin-bottom:8px"></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button type="button" class="secondary-btn" id="tpl-var-add" style="width:36px;height:36px;border-radius:50%;padding:0;font-size:18px;line-height:1" title="${state.lang === 'ru' ? 'Добавить переменную' : 'Add variable'}">+</button>
        <span class="small muted-text">${state.lang === 'ru' ? 'Добавить переменную' : 'Add variable'}</span>
      </div>
    </div>
    <div class="field">
      <div class="stacked-label">${state.lang === 'ru' ? 'Шапка (RU)' : 'Header (RU)'}</div>
      <textarea class="textarea input" id="tpl-header-ru" rows="5" placeholder="${state.lang === 'ru' ? 'Например: Кому/От/Паспорт/Адрес… Можно использовать {{key}}' : 'Header text. Use {{key}} placeholders.'}">${escapeHtml(headerRu)}</textarea>
    </div>
    <div class="field">
      <div class="stacked-label">${state.lang === 'ru' ? 'Шапка (EN)' : 'Header (EN)'}</div>
      <textarea class="textarea input" id="tpl-header-en" rows="5" placeholder="...">${escapeHtml(headerEn)}</textarea>
    </div>
      <div class="field">
      <div class="stacked-label">${t.templateTitleRu}</div>
      <textarea class="textarea input" id="tpl-title-ru" rows="3" placeholder="Например: ЗАПРОС о предоставлении документов (для официального обращения)">${escapeHtml(titleRu)}</textarea>
    </div>
    <div class="field">
      <div class="stacked-label">${t.templateBodyRu}</div>
      <textarea class="textarea input" id="tpl-body-ru" rows="14" placeholder="Текст письма на русском. Списки: строка с «- » (дефис и пробел); подпункты — с отступом «  - ».">${escapeHtml(bodyRu)}</textarea>
      <p class="small muted-text" style="margin-top:6px">Списки: каждая строка с «- » (дефис и пробел). Подпункты — с отступом в два пробела.</p>
    </div>
    <div class="field">
      <div class="stacked-label">${t.templateTitleEn}</div>
      <textarea class="textarea input" id="tpl-title-en" rows="3" placeholder="...">${escapeHtml(titleEn)}</textarea>
    </div>
    <div class="field">
      <div class="stacked-label">${t.templateBodyEn}</div>
      <textarea class="textarea input" id="tpl-body-en" rows="8" placeholder="...">${escapeHtml(bodyEn)}</textarea>
    </div>
    <div class="btn-row" style="gap:8px;flex-wrap:wrap;">
      <button type="button" class="secondary-btn" id="tpl-cancel">${t.templateCancel}</button>
      <button type="button" class="primary-btn" id="tpl-save">${t.templateSave}</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let activeTextareaId = 'tpl-body-ru';
  ['tpl-header-ru', 'tpl-header-en', 'tpl-title-ru', 'tpl-title-en', 'tpl-body-ru', 'tpl-body-en'].forEach((id) => {
    const el = box.querySelector('#' + id);
    if (el) el.addEventListener('focus', () => { activeTextareaId = id; });
  });

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  box.querySelector('#tpl-cancel').addEventListener('click', close);
  function insertAtCursor(textareaId, token) {
    const ta = box.querySelector('#' + textareaId);
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd, val = ta.value;
    ta.value = val.slice(0, start) + token + val.slice(end);
    ta.selectionStart = ta.selectionEnd = start + token.length;
    ta.focus();
  }

  function getPaletteVars() {
    const list = Array.isArray(state.templateVariables) && state.templateVariables.length
      ? state.templateVariables
      : PREDEFINED_VARIABLES.map((v) => ({ id: null, key: v.key, label_ru: v.labelRu, label_en: v.labelEn, sort_order: 0 }));
    return list;
  }

  function renderPalette() {
    const pal = box.querySelector('#tpl-var-palette');
    if (!pal) return;
    const vars = getPaletteVars();
    pal.innerHTML = vars.map((v) => {
      const label = state.lang === 'ru' ? (v.label_ru || v.key) : (v.label_en || v.key);
      const del = v.id ? `<button type="button" class="tpl-dict-del" data-id="${escapeHtml(String(v.id))}" style="margin-left:6px;background:none;border:none;cursor:pointer;color:#666;font-size:16px;line-height:1;padding:0" aria-label="Удалить">&times;</button>` : '';
      return `<span class="tpl-dict-pill" style="display:inline-flex;align-items:center;gap:0;background:var(--bg-soft,#eee);border-radius:999px;padding:6px 10px;font-size:13px">
        <button type="button" class="tpl-dict-insert" data-key="${escapeHtml(String(v.key))}" style="background:none;border:none;cursor:pointer;padding:0;margin:0;font:inherit;color:inherit">${escapeHtml(label)}</button>
        ${del}
      </span>`;
    }).join('');

    pal.querySelectorAll('.tpl-dict-insert').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        if (!key) return;
        insertAtCursor(activeTextareaId, `{{${key}}}`);
      });
    });
    pal.querySelectorAll('.tpl-dict-del').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (!confirm(state.lang === 'ru' ? 'Удалить переменную? Она исчезнет из списка, но в старых шаблонах {{key}} останется текстом.' : 'Delete variable?')) return;
        try {
          await deleteAdminVariable(id);
          const vars = await fetchAdminVariables();
          state.templateVariables = vars.filter((x) => x.is_active !== false).map((x) => ({
            id: x.id, key: x.key, label_ru: x.label_ru || '', label_en: x.label_en || '', sort_order: x.sort_order ?? 0,
          }));
          renderPalette();
        } catch (e) {
          alert((state.lang === 'ru' ? 'Ошибка: ' : 'Error: ') + (e?.message || ''));
        }
      });
    });
  }

  function openAddVariableModal() {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    const bx = document.createElement('div');
    bx.className = 'neo-card';
    bx.style.cssText = 'max-width:520px;width:100%;max-height:90vh;overflow:auto;';
    bx.innerHTML = `
      <h3 class="preview-title" style="margin-top:0">${state.lang === 'ru' ? 'Новая переменная' : 'New variable'}</h3>
      <div class="field">
        <div class="stacked-label">${state.lang === 'ru' ? 'Ключ (для {{key}})' : 'Key (for {{key}})'}</div>
        <input class="input" id="var-key" placeholder="fullName" />
      </div>
      <div class="field">
        <div class="stacked-label">${state.lang === 'ru' ? 'Подпись (RU)' : 'Label (RU)'}</div>
        <input class="input" id="var-ru" placeholder="${state.lang === 'ru' ? 'ФИО полностью' : 'Full name (RU)'}" />
      </div>
      <div class="field">
        <div class="stacked-label">${state.lang === 'ru' ? 'Подпись (EN)' : 'Label (EN)'}</div>
        <input class="input" id="var-en" placeholder="Full name" />
      </div>
      <div class="field" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <label class="checkbox-pill" style="margin:0">
          <input type="checkbox" id="var-active" checked />
          ${state.lang === 'ru' ? 'Активна' : 'Active'}
        </label>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="stacked-label" style="margin:0">${state.lang === 'ru' ? 'Сортировка' : 'Sort order'}</div>
          <input class="input" id="var-sort" type="number" style="width:110px" value="0" />
        </div>
      </div>
      <div class="btn-row" style="gap:8px;flex-wrap:wrap;">
        <button type="button" class="secondary-btn" id="var-cancel">${state.lang === 'ru' ? 'Отмена' : 'Cancel'}</button>
        <button type="button" class="primary-btn" id="var-save">${state.lang === 'ru' ? 'Добавить' : 'Add'}</button>
      </div>
    `;
    ov.appendChild(bx);
    document.body.appendChild(ov);
    const closeVar = () => ov.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov) closeVar(); });
    bx.querySelector('#var-cancel').addEventListener('click', closeVar);
    bx.querySelector('#var-save').addEventListener('click', async () => {
      const key = (bx.querySelector('#var-key').value || '').trim();
      if (!key) { alert(state.lang === 'ru' ? 'Укажите ключ' : 'Enter key'); return; }
      try {
        await createAdminVariable({
          key,
          label_ru: (bx.querySelector('#var-ru').value || '').trim(),
          label_en: (bx.querySelector('#var-en').value || '').trim(),
          is_active: bx.querySelector('#var-active').checked,
          sort_order: parseInt(bx.querySelector('#var-sort').value || '0', 10) || 0,
        });
        const vars = await fetchAdminVariables();
        state.templateVariables = vars.filter((x) => x.is_active !== false).map((x) => ({
          id: x.id, key: x.key, label_ru: x.label_ru || '', label_en: x.label_en || '', sort_order: x.sort_order ?? 0,
        }));
        renderPalette();
        closeVar();
      } catch (e) {
        alert((state.lang === 'ru' ? 'Ошибка: ' : 'Error: ') + (e?.message || ''));
      }
    });
  }

  const addBtn = box.querySelector('#tpl-var-add');
  if (addBtn) addBtn.addEventListener('click', openAddVariableModal);

  // первичная отрисовка палитры переменных
  renderPalette();

  const varButtons = getPaletteVars().map((v) => ({ key: v.key, label: state.lang === 'ru' ? (v.label_ru || v.key) : (v.label_en || v.key) }));
  const varBtnsHtml = varButtons.map((v) => `<button type="button" class="secondary-btn tpl-var-btn" data-var="{{${v.key}}}" data-target="tpl-body-ru" style="font-size:12px;padding:4px 8px">${escapeHtml(v.label)}</button>`).join('');

  const bodyRuWrap = box.querySelector('#tpl-body-ru')?.closest('.field');
  if (bodyRuWrap) {
    const div = document.createElement('div');
    div.className = 'small muted-text';
    div.style.marginTop = '8px';
    div.innerHTML = `<div style="margin-bottom:6px">Вставить переменную (подставится из формы пользователя):</div><div style="display:flex;flex-wrap:wrap;gap:6px">${varBtnsHtml}</div>`;
    bodyRuWrap.appendChild(div);
    bodyRuWrap.querySelectorAll('.tpl-var-btn').forEach((btn) => {
      btn.addEventListener('click', () => insertAtCursor(btn.getAttribute('data-target'), btn.getAttribute('data-var')));
    });
  }
  const varBtnsHtmlEn = varButtons.map((v) => `<button type="button" class="secondary-btn tpl-var-btn" data-var="{{${v.key}}}" data-target="tpl-body-en" style="font-size:12px;padding:4px 8px">${v.key}</button>`).join('');
  const bodyEnWrap = box.querySelector('#tpl-body-en')?.closest('.field');
  if (bodyEnWrap) {
    const div = document.createElement('div');
    div.className = 'small muted-text';
    div.style.marginTop = '8px';
    div.innerHTML = `<div style="margin-bottom:6px">Insert variable:</div><div style="display:flex;flex-wrap:wrap;gap:6px">${varBtnsHtmlEn}</div>`;
    bodyEnWrap.appendChild(div);
    bodyEnWrap.querySelectorAll('.tpl-var-btn').forEach((btn) => {
      btn.addEventListener('click', () => insertAtCursor(btn.getAttribute('data-target'), btn.getAttribute('data-var')));
    });
  }

  box.querySelector('#tpl-save').addEventListener('click', async () => {
    const headerRu = box.querySelector('#tpl-header-ru').value || '';
    const headerEn = box.querySelector('#tpl-header-en').value || '';
    const titleRu = box.querySelector('#tpl-title-ru').value || '';
    const titleEn = box.querySelector('#tpl-title-en').value || '';
    const bodyRu = box.querySelector('#tpl-body-ru').value || '';
    const bodyEn = box.querySelector('#tpl-body-en').value || '';
    const payload = {
      name: box.querySelector('#tpl-name').value.trim(),
      description: box.querySelector('#tpl-desc').value.trim(),
      is_active: box.querySelector('#tpl-active').checked,
      sort_order: parseInt(box.querySelector('#tpl-sort').value || '0', 10) || 0,
      header_ru: headerRu,
      header_en: headerEn,
      title_ru: titleRu,
      title_en: titleEn,
      body_ru: bodyRu,
      body_en: bodyEn,
      content: { header: { ru: headerRu, en: headerEn }, title: { ru: titleRu, en: titleEn }, body: { ru: bodyRu, en: bodyEn } },
    };
    if (!payload.name) {
      alert(state.lang === 'ru' ? 'Укажите название шаблона' : 'Enter template name');
      return;
    }
    try {
      if (tpl.id) await updateAdminTemplate(tpl.id, payload);
      else await createAdminTemplate(payload);
      close();
      await initAppConfig(); // обновить список для пользователя
      renderAdmin();
    } catch (e) {
      alert((state.lang === 'ru' ? 'Ошибка: ' : 'Error: ') + (e?.message || ''));
    }
  });
}

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

  const tab = state.adminTab || 'orders';
  let orders = state.adminOrders;
  let templates = state.adminTemplates;
  let pricing = state.adminPricing;
  let appearance = state.adminAppearance;
  let texts = state.adminTexts;
  let loading = false;
  try {
    loading = true;
    if (tab === 'templates') {
      templates = await fetchAdminTemplates();
      state.adminTemplates = templates;
    } else if (tab === 'pricing') {
      pricing = await fetchAdminPricing();
      state.adminPricing = pricing;
    } else if (tab === 'appearance') {
      appearance = await fetchAdminAppearance();
      state.adminAppearance = appearance;
    } else if (tab === 'texts') {
      texts = await fetchAdminTexts();
      state.adminTexts = texts;
    } else {
      orders = await fetchAdminOrders();
      state.adminOrders = orders;
    }
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
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <div>
              <h2 class="section-title">${t.title}</h2>
              <p class="section-subtitle">${t.subtitle}</p>
            </div>
            <button type="button" id="admin-help-btn" class="secondary-btn" style="border-radius:999px;width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;font-weight:600" aria-label="${state.lang === 'ru' ? 'Инструкция' : 'Help'}">!</button>
          </div>
          <a href="#" class="secondary-btn" style="margin-bottom:20px;display:inline-block" onclick="window.location.hash=''; render(); return false;">&larr; ${state.lang === 'ru' ? 'На главную' : 'Back'}</a>
          <div class="profile-tabs profile-tabs-split" style="margin-bottom:12px">
            <button class="profile-tab-btn ${tab === 'orders' ? 'active' : ''}" data-tab="orders">${t.tabOrders}</button>
            <button class="profile-tab-btn ${tab === 'templates' ? 'active' : ''}" data-tab="templates">${t.tabTemplates}</button>
            <button class="profile-tab-btn ${tab === 'pricing' ? 'active' : ''}" data-tab="pricing">${t.tabPricing}</button>
            <button class="profile-tab-btn ${tab === 'appearance' ? 'active' : ''}" data-tab="appearance">${t.tabAppearance}</button>
            <button class="profile-tab-btn ${tab === 'texts' ? 'active' : ''}" data-tab="texts">${t.tabTexts}</button>
          </div>
          <div id="admin-orders-list" style="${tab === 'orders' ? '' : 'display:none'}"></div>
          <div id="admin-templates-list" style="${tab === 'templates' ? '' : 'display:none'}">
            <div class="btn-row" style="margin-bottom:12px;gap:8px;flex-wrap:wrap;">
              <button class="secondary-btn" id="admin-create-template">${t.createTemplate}</button>
            </div>
            <div id="admin-templates-items"></div>
          </div>
          <div id="admin-pricing-list" style="${tab === 'pricing' ? '' : 'display:none'}">
            <div class="neo-card" style="max-width:400px;padding:20px">
              <div class="field" style="margin-bottom:16px">
                <label class="stacked-label" for="admin-price-base">${t.priceBaseLabel}</label>
                <input type="number" min="1" step="1" class="input" id="admin-price-base" value="${escapeHtml(String((pricing && pricing.base_price_rub) || 700))}" />
              </div>
              <div class="field" style="margin-bottom:16px">
                <label class="stacked-label" for="admin-price-expert">${t.priceExpertLabel}</label>
                <input type="number" min="1" step="1" class="input" id="admin-price-expert" value="${escapeHtml(String((pricing && pricing.expert_price_rub) || 2200))}" />
              </div>
              <button type="button" class="primary-btn" id="admin-save-prices">${t.savePrices}</button>
            </div>
          </div>
          <div id="admin-appearance-list" style="${tab === 'appearance' ? '' : 'display:none'}">
            <div class="neo-card" style="max-width:520px;padding:20px">
              <h3 class="section-title" style="font-size:18px;margin-top:0;margin-bottom:16px">${t.appearanceTitle}</h3>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-bg">${t.themeBgLabel}</label>
                <input type="color" id="theme-bg" value="${escapeHtml(String((appearance && appearance.bg_color) || '#e4ebf5'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-bg-elevated">${t.themeBgElevatedLabel}</label>
                <input type="color" id="theme-bg-elevated" value="${escapeHtml(String((appearance && appearance.bg_elevated_color) || '#ecf2ff'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-header-bg">Шапка (header)</label>
                <input type="color" id="theme-header-bg" value="${escapeHtml(String((appearance && appearance.header_bg) || '#ffffff'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-footer-bg">Подвал (footer)</label>
                <input type="color" id="theme-footer-bg" value="${escapeHtml(String((appearance && appearance.footer_bg) || '#f4f7fc'))}" />
              </div>
              <div class="field" style="margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap">
                <div style="flex:1;min-width:140px">
                  <label class="stacked-label" for="theme-grad-from">${t.themeGradFromLabel}</label>
                  <input type="color" id="theme-grad-from" value="${escapeHtml(String((appearance && appearance.bg_gradient_from) || '#f5f7fb'))}" />
                </div>
                <div style="flex:1;min-width:140px">
                  <label class="stacked-label" for="theme-grad-to">${t.themeGradToLabel}</label>
                  <input type="color" id="theme-grad-to" value="${escapeHtml(String((appearance && appearance.bg_gradient_to) || '#dfe7f3'))}" />
                </div>
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-accent">${t.themeAccentLabel}</label>
                <input type="color" id="theme-accent" value="${escapeHtml(String((appearance && appearance.accent_color) || '#8b5cf6'))}" />
              </div>
              <div class="field" style="margin-bottom:16px">
                <label class="stacked-label" for="theme-border">${t.themeBorderLabel}</label>
                <input type="color" id="theme-border" value="${escapeHtml(String((appearance && appearance.border_color) || '#cfd8e7'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-tabs-bg">Фон вкладок/панелей</label>
                <input type="color" id="theme-tabs-bg" value="${escapeHtml(String((appearance && appearance.tabs_bg) || '#eef3ff'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-preview-bg">Фон предпросмотра письма</label>
                <input type="color" id="theme-preview-bg" value="${escapeHtml(String((appearance && appearance.preview_bg) || '#f9fafb'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-primary-btn-bg">Primary‑кнопка (фон)</label>
                <input type="color" id="theme-primary-btn-bg" value="${escapeHtml(String((appearance && appearance.primary_btn_bg) || '#8b5cf6'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-primary-btn-text">Primary‑кнопка (текст)</label>
                <input type="color" id="theme-primary-btn-text" value="${escapeHtml(String((appearance && appearance.primary_btn_text) || '#f9fafb'))}" />
              </div>
              <div class="field" style="margin-bottom:12px">
                <label class="stacked-label" for="theme-secondary-btn-bg">Secondary‑кнопка (фон)</label>
                <input type="color" id="theme-secondary-btn-bg" value="${escapeHtml(String((appearance && appearance.secondary_btn_bg) || '#e4ebf5'))}" />
              </div>
              <div class="field" style="margin-bottom:16px">
                <label class="stacked-label" for="theme-secondary-btn-text">Secondary‑кнопка (текст)</label>
                <input type="color" id="theme-secondary-btn-text" value="${escapeHtml(String((appearance && appearance.secondary_btn_text) || '#111827'))}" />
              </div>
              <div class="btn-row" style="gap:8px;flex-wrap:wrap">
                <button type="button" class="primary-btn" id="admin-save-theme">${t.saveTheme}</button>
                <button type="button" class="secondary-btn" id="admin-reset-theme">${t.resetTheme}</button>
              </div>
            </div>
          </div>
          <div id="admin-texts-list" style="${tab === 'texts' ? '' : 'display:none'}">
            <div class="neo-card" style="max-width:100%;padding:20px">
              <h3 class="section-title" style="font-size:18px;margin-top:0;margin-bottom:8px">${t.textsTitle}</h3>
              <p class="small muted-text" style="margin-bottom:16px">${t.textsHint}</p>
              <div class="table-wrapper" style="max-height:60vh;overflow:auto">
                <table class="table">
                  <thead>
                    <tr>
                      <th style="width:20%">${t.textsKey}</th>
                      <th style="width:40%">${t.textsRu}</th>
                      <th style="width:40%">${t.textsEn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      (function() {
                        const rows = [];
                        const addRow = (key) => {
                          const ruOverride = (texts || []).find((x) => x.key === key && x.lang === 'ru');
                          const enOverride = (texts || []).find((x) => x.key === key && x.lang === 'en');
                          const ruBase = key.split('.').reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : ''), I18N_BASE.ru);
                          const enBase = key.split('.').reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : ''), I18N_BASE.en);
                          const ruVal = ruOverride ? ruOverride.value : (typeof ruBase === 'string' ? ruBase : '');
                          const enVal = enOverride ? enOverride.value : (typeof enBase === 'string' ? enBase : '');
                          rows.push(
                            `<tr>
                              <td><code>${escapeHtml(key)}</code></td>
                              <td><textarea class="textarea input admin-text-ru" data-key="${escapeHtml(key)}" rows="2">${escapeHtml(String(ruVal || ''))}</textarea></td>
                              <td><textarea class="textarea input admin-text-en" data-key="${escapeHtml(key)}" rows="2">${escapeHtml(String(enVal || ''))}</textarea></td>
                            </tr>`
                          );
                        };
                        const traverse = (obj, prefix, excludeAdmin) => {
                          Object.keys(obj || {}).forEach((k) => {
                            if (excludeAdmin && k === 'admin') return;
                            const val = obj[k];
                            const path = prefix ? prefix + '.' + k : k;
                            if (typeof val === 'string') {
                              addRow(path);
                            } else if (val && typeof val === 'object') {
                              traverse(val, path, false);
                            }
                          });
                        };
                        traverse(I18N_BASE.ru, '', true);
                        return rows.join('');
                      })()
                    }
                  </tbody>
                </table>
              </div>
              <div class="btn-row" style="gap:8px;flex-wrap:wrap;margin-top:16px;flex-direction:row;justify-content:flex-start">
                <button type="button" class="primary-btn" id="admin-save-texts">${t.saveTexts}</button>
                <button type="button" class="secondary-btn" id="admin-reset-texts">${t.resetTexts}</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  // tabs
  document.querySelectorAll('#admin .profile-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-tab');
      if (!next || next === state.adminTab) return;
      state.adminTab = next;
      renderAdmin();
    });
  });

  // help modal
  const helpBtn = document.getElementById('admin-help-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
      const box = document.createElement('div');
      box.className = 'neo-card';
      box.style.cssText = 'max-width:820px;width:100%;max-height:90vh;overflow:auto;';
      box.innerHTML = `
        <h3 class="preview-title" style="margin-top:0">${t.helpTitle}</h3>
        <div class="field">
          <div class="stacked-label">${t.helpOrdersTitle}</div>
          <div class="small" style="line-height:1.6">${t.helpOrdersText}</div>
        </div>
        <div class="field">
          <div class="stacked-label">${t.helpTemplatesTitle}</div>
          <div class="small" style="line-height:1.6">${t.helpTemplatesText}</div>
        </div>
        <div class="field">
          <div class="stacked-label">${t.helpVariablesTitle}</div>
          <div class="small" style="line-height:1.6">${t.helpVariablesText}</div>
        </div>
        <div class="field">
          <div class="stacked-label">${t.helpPricingTitle}</div>
          <div class="small" style="line-height:1.6">${t.helpPricingText}</div>
        </div>
        <div class="field">
          <div class="stacked-label">${t.helpAppearanceTitle}</div>
          <div class="small" style="line-height:1.6">${t.helpAppearanceText}</div>
        </div>
        <div class="field">
          <div class="stacked-label">${t.helpTextsTitle}</div>
          <div class="small" style="line-height:1.6">${t.helpTextsText}</div>
        </div>
        <p class="small muted-text" style="margin-top:8px">${t.helpFooter}</p>
        <div class="btn-row" style="gap:8px;flex-wrap:wrap;margin-top:16px;">
          <button type="button" class="primary-btn" id="admin-help-close">${state.lang === 'ru' ? 'Понятно' : 'Got it'}</button>
        </div>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      const close = () => overlay.remove();
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
      box.querySelector('#admin-help-close').addEventListener('click', close);
    });
  }

  if (tab === 'templates') {
    const itemsEl = document.getElementById('admin-templates-items');
    const createBtn = document.getElementById('admin-create-template');
    if (createBtn) createBtn.addEventListener('click', () => openTemplateEditorModal(null));

    if (itemsEl) {
      if (!templates || templates.length === 0) {
        itemsEl.innerHTML = `<p class="small muted-text">${t.templatesEmpty}</p>`;
      } else {
        itemsEl.innerHTML = templates.map((tpl) => {
          const activeTag = tpl.is_active ? `<span class="tag" style="background:rgba(34,197,94,0.12);color:#166534;padding:4px 8px;border-radius:6px">${t.templateActive}</span>` : '';
          return `
            <div class="neo-card" style="margin-bottom:12px;padding:14px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap" data-template-id="${escapeHtml(String(tpl.id))}">
              <div style="flex:1;min-width:220px">
                <div style="font-weight:600;margin-bottom:6px">${escapeHtml(String(tpl.name || 'Template'))} ${activeTag}</div>
                ${tpl.description ? `<div class="small muted-text">${escapeHtml(String(tpl.description))}</div>` : ''}
                <div class="small muted-text" style="margin-top:6px">id: ${escapeHtml(String(tpl.id))} · sort: ${escapeHtml(String(tpl.sort_order ?? 0))}</div>
              </div>
              <div style="display:flex;gap:8px;flex-shrink:0">
                <button class="secondary-btn admin-tpl-edit" data-id="${escapeHtml(String(tpl.id))}">${t.editTemplate}</button>
                <button class="secondary-btn admin-tpl-del" data-id="${escapeHtml(String(tpl.id))}" style="color:var(--danger, #c33)">${t.deleteTemplate}</button>
              </div>
            </div>
          `;
        }).join('');

        itemsEl.querySelectorAll('.admin-tpl-edit').forEach((b) => {
          b.addEventListener('click', () => {
            const id = b.getAttribute('data-id');
            const tpl = (state.adminTemplates || []).find((x) => String(x.id) === String(id));
            if (tpl) openTemplateEditorModal(tpl);
          });
        });
        itemsEl.querySelectorAll('.admin-tpl-del').forEach((b) => {
          b.addEventListener('click', async () => {
            const id = b.getAttribute('data-id');
            if (!id) return;
            if (!confirm(state.lang === 'ru' ? 'Удалить шаблон?' : 'Delete template?')) return;
            try {
              await deleteAdminTemplate(id);
              state.adminTemplates = (state.adminTemplates || []).filter((x) => String(x.id) !== String(id));
              await initAppConfig();
              renderAdmin();
            } catch (e) {
              alert((state.lang === 'ru' ? 'Ошибка: ' : 'Error: ') + (e?.message || ''));
            }
          });
        });
      }
    }
    return;
  }

  if (tab === 'pricing') {
    const saveBtn = document.getElementById('admin-save-prices');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const baseEl = document.getElementById('admin-price-base');
        const expertEl = document.getElementById('admin-price-expert');
        const base = parseInt(baseEl?.value, 10);
        const expert = parseInt(expertEl?.value, 10);
        if (!Number.isFinite(base) || base < 1 || !Number.isFinite(expert) || expert < 1) {
          alert(t.pricesError);
          return;
        }
        try {
          const updated = await updateAdminPricing({ base_price_rub: base, expert_price_rub: expert });
          setPricing(updated);
          await initAppConfig();
          alert(t.pricesSaved);
          renderAdmin();
        } catch (e) {
          alert(t.pricesError + ': ' + (e?.message || ''));
        }
      });
    }
    return;
  }

  if (tab === 'appearance') {
    const saveBtn = document.getElementById('admin-save-theme');
    const resetBtn = document.getElementById('admin-reset-theme');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const bg = document.getElementById('theme-bg')?.value || '';
        const bgElevated = document.getElementById('theme-bg-elevated')?.value || '';
        const gradFrom = document.getElementById('theme-grad-from')?.value || '';
        const gradTo = document.getElementById('theme-grad-to')?.value || '';
        const accent = document.getElementById('theme-accent')?.value || '';
        const border = document.getElementById('theme-border')?.value || '';
      const headerBg = document.getElementById('theme-header-bg')?.value || '';
      const footerBg = document.getElementById('theme-footer-bg')?.value || '';
      const tabsBg = document.getElementById('theme-tabs-bg')?.value || '';
      const previewBg = document.getElementById('theme-preview-bg')?.value || '';
      const primaryBtnBg = document.getElementById('theme-primary-btn-bg')?.value || '';
      const primaryBtnText = document.getElementById('theme-primary-btn-text')?.value || '';
      const secondaryBtnBg = document.getElementById('theme-secondary-btn-bg')?.value || '';
      const secondaryBtnText = document.getElementById('theme-secondary-btn-text')?.value || '';
        try {
          const updated = await updateAdminAppearance({
            bg_color: bg,
            bg_elevated_color: bgElevated,
            bg_gradient_from: gradFrom,
            bg_gradient_to: gradTo,
            accent_color: accent,
            border_color: border,
          header_bg: headerBg,
          footer_bg: footerBg,
          tabs_bg: tabsBg,
          preview_bg: previewBg,
          primary_btn_bg: primaryBtnBg,
          primary_btn_text: primaryBtnText,
          secondary_btn_bg: secondaryBtnBg,
          secondary_btn_text: secondaryBtnText,
          });
          setAppearance(updated);
          alert(t.themeSaved);
          renderAdmin();
        } catch (e) {
          alert((t.pricesError || 'Ошибка') + ': ' + (e?.message || ''));
        }
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!confirm(state.lang === 'ru' ? 'Сбросить оформление к стандартному?' : 'Reset appearance to default?')) return;
        try {
          await resetAdminAppearance();
          setAppearance(null);
          alert(t.themeReset);
          renderAdmin();
        } catch (e) {
          alert((t.pricesError || 'Ошибка') + ': ' + (e?.message || ''));
        }
      });
    }
    return;
  }

  if (tab === 'texts') {
    const saveBtn = document.getElementById('admin-save-texts');
    const resetBtn = document.getElementById('admin-reset-texts');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        try {
          const rows = [];
          document.querySelectorAll('#admin-texts-list .admin-text-ru').forEach((ta) => {
            const key = ta.getAttribute('data-key');
            if (!key) return;
            rows.push({ key, lang: 'ru', value: ta.value });
          });
          document.querySelectorAll('#admin-texts-list .admin-text-en').forEach((ta) => {
            const key = ta.getAttribute('data-key');
            if (!key) return;
            rows.push({ key, lang: 'en', value: ta.value });
          });
          const updated = await saveAdminTexts(rows);
          state.adminTexts = updated;
          setTexts(updated);
          alert(t.textsSaved);
        } catch (e) {
          alert((t.pricesError || 'Ошибка') + ': ' + (e?.message || ''));
        }
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', async () => {
        if (!confirm(state.lang === 'ru' ? 'Сбросить все изменения текстов к исходным?' : 'Reset all text changes to defaults?')) return;
        try {
          await resetAdminTexts();
          state.adminTexts = [];
          // перезагрузить конфиг, чтобы вернулся базовый I18N без оверрайдов
          // (initAppConfig заново применит setTexts с пустым списком)
          await initAppConfig();
          alert(t.textsReset);
          renderAdmin();
        } catch (e) {
          alert((t.pricesError || 'Ошибка') + ': ' + (e?.message || ''));
        }
      });
    }
    return;
  }

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
            <a href="#legal-codex" class="secondary-btn" style="text-align:center;text-decoration:none">${t.codexTitle}</a>
            <a href="#legal-declaration" class="secondary-btn" style="text-align:center;text-decoration:none">${t.declarationTitle}</a>
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
  const titles = { offer: t.offerTitle, privacy: t.privacyTitle, codex: t.codexTitle, declaration: t.declarationTitle };
  const contents = { offer: t.offerPage, privacy: t.privacyPage, codex: t.codexPage, declaration: t.declarationPage };
  const title = titles[type] || t.offerTitle;
  const content = contents[type] || t.offerPage;

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
  const isAdmin = !!state.isAdmin;
  appRoot.innerHTML = `
    <div class="blog-page-wrap">
      <div class="neo-card blog-hero-card ${isAdmin ? 'blog-hero-card-with-add' : ''}">
        ${isAdmin ? `<button type="button" class="blog-add-btn" id="blog-add-btn" title="${t.createPost}" aria-label="${t.createPost}">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>` : ''}
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
      const canEditComment = (c) => state.user && c.user_id && state.user.id && String(c.user_id) === String(state.user.id);
      const commentsList = comments.length === 0
        ? `<p class="small muted-text" style="margin:0 0 12px">${t.commentsEmpty}</p>`
        : comments.map(c => {
          const canEdit = canEditComment(c);
          const canDelete = state.isAdmin || canEditComment(c);
          const btns = [];
          if (canEdit) btns.push(`<button type="button" class="secondary-btn blog-edit-comment" data-comment-id="${c.id}" data-post-id="${post.id}" style="flex-shrink:0;padding:4px 10px;font-size:12px">${t.editComment}</button>`);
          if (canDelete) btns.push(`<button type="button" class="secondary-btn blog-delete-comment" data-comment-id="${c.id}" data-post-id="${post.id}" style="flex-shrink:0;padding:4px 10px;font-size:12px">${t.deleteComment}</button>`);
          return `<div class="blog-comment-item" data-comment-id="${c.id}" data-post-id="${post.id}" style="background:var(--bg-elevated);border-radius:8px;padding:12px 16px;margin-bottom:8px">
            <div class="blog-comment-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;color:var(--accent);margin-bottom:4px">${escapeHtml(c.author_name || '—')}</div>
                <div class="blog-comment-body" style="font-size:14px;line-height:1.5">${escapeHtml(c.text)}</div>
              </div>
              ${btns.length ? `<div style="display:flex;gap:6px;flex-shrink:0">${btns.join('')}</div>` : ''}
            </div>
          </div>`;
        }).join('');
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

    document.querySelectorAll('.blog-delete-comment').forEach(btn => {
      btn.addEventListener('click', async () => {
        const commentId = btn.getAttribute('data-comment-id');
        const postId = btn.getAttribute('data-post-id');
        if (!commentId || !confirm(ru ? 'Удалить комментарий?' : 'Delete comment?')) return;
        try {
          await deleteBlogComment(commentId);
          const post = state.blogPosts.find(p => p.id === postId);
          if (post) post.comments = await fetchBlogComments(postId);
          alert(t.commentDeleted);
          renderBlog();
        } catch (e) { alert(e.message); }
      });
    });

    document.querySelectorAll('.blog-edit-comment').forEach(btn => {
      btn.addEventListener('click', () => {
        const commentId = btn.getAttribute('data-comment-id');
        const postId = btn.getAttribute('data-post-id');
        const item = btn.closest('.blog-comment-item');
        const bodyEl = item?.querySelector('.blog-comment-body');
        const headerEl = item?.querySelector('.blog-comment-header');
        if (!bodyEl || !headerEl) return;
        const currentText = bodyEl.textContent;
        const authorName = bodyEl.previousElementSibling?.textContent || '';
        headerEl.innerHTML = `
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px;color:var(--accent);margin-bottom:8px">${escapeHtml(authorName)}</div>
            <textarea class="input comment-edit-textarea" rows="3" style="width:100%;margin-bottom:8px;resize:vertical">${escapeHtml(currentText)}</textarea>
            <div style="display:flex;gap:8px">
              <button type="button" class="primary-btn blog-save-comment" data-comment-id="${commentId}" data-post-id="${postId}">${t.saveComment}</button>
              <button type="button" class="secondary-btn blog-cancel-comment" data-post-id="${postId}">${t.cancelComment}</button>
            </div>
          </div>
        `;
        const textarea = headerEl.querySelector('.comment-edit-textarea');
        const saveBtn = headerEl.querySelector('.blog-save-comment');
        const cancelBtn = headerEl.querySelector('.blog-cancel-comment');
        saveBtn?.addEventListener('click', async () => {
          const text = textarea?.value?.trim();
          if (!text) return;
          saveBtn.disabled = true;
          try {
            await updateBlogComment(commentId, text);
            const post = state.blogPosts.find(p => p.id === postId);
            if (post) post.comments = await fetchBlogComments(postId);
            renderBlog();
          } catch (e) { alert(e.message); saveBtn.disabled = false; }
        });
        cancelBtn?.addEventListener('click', () => renderBlog());
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
    const hash = window.location.hash || "";
    const scrollToTop = hash === "" || hash === "#" || hash === "#hero" ||
      hash === "#legal" || hash === "#legal-offer" || hash === "#legal-privacy" || hash === "#legal-codex" || hash === "#legal-declaration" ||
      hash === "#blog" || hash.startsWith("#blog/");
    if (scrollToTop) window.scrollTo(0, 0);
    render();
  });

  state.blogPosts = [];
  initProfile();

  const hasPayment = new URLSearchParams(window.location.search).get('payment');
  if (hasPayment) showPaymentReturnLoader();
  Promise.all([initAppConfig(), initAuth()]).then(() => {
    if (hasPayment) applyPaymentReturn();
    else render();
  });
}

initShell();
