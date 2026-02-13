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

window.KonstructAuth = {
  onWidgetAuth: async function(telegramUser) {
    try {
      const { user } = await authViaTelegram('widget', { widgetData: telegramUser });
      state.user = { ...user, photo_url: user.photo_url };
      localStorage.setItem('user', JSON.stringify(state.user));
      updateProfileUI();
      closeProfileDropdown();
      render();
    } catch (e) {
      alert(state.lang === 'ru' ? 'Ошибка входа' : 'Login failed');
    }
  },
};

function checkSavedAuth() {
  const saved = localStorage.getItem('user');
  if (saved) {
    try {
      state.user = JSON.parse(saved);
    } catch {}
  }
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
  updateProfileUI();
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('user');
  updateProfileUI();
  closeProfileDropdown();
  render();
}

// ========== ORDERS (демо) ==========

async function fetchOrders() {
  return state.documents || [];
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
      saveDraft: "Сохранить черновик (демо)",
      createOrder: "Создать заказ (демо)",
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
      offerBody:
        "На этапе прототипа здесь размещается укороченный текст оферты. В финальной версии юрист подготовит полноценный документ, а разработчик просто подставит его в этот блок.",
      privacyTitle: "Политика конфиденциальности",
      privacyBody:
        "Описывает, как обрабатываются персональные данные пользователей сервиса. Сейчас это заглушка, чтобы показать наличие раздела и ссылок в футере.",
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
      saveDraft: "Save draft (demo)",
      createOrder: "Create order (demo)",
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
      offerBody:
        "At the prototype stage we place a shortened offer text here. Later a lawyer will prepare a full document which will simply be inserted into this block.",
      privacyTitle: "Privacy policy",
      privacyBody:
        "Describes how users' personal data is processed. For now this is a placeholder to show that such a section and footer links exist.",
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

function saveDraft() {
  state.draft = {
    ...state.constructorForm,
    withExpert: state.withExpert,
  };
  alert(I18N[state.lang].alerts.draftSaved);
}

function createOrder() {
  if (!state.user) {
    alert(I18N[state.lang].alerts.mustLogin);
    return;
  }
  const id = "order-" + (state.documents.length + 1);
  const order = {
    id,
    visitorEmail: state.user.email,
    data: { ...state.constructorForm },
    withExpert: state.withExpert,
    status: state.withExpert ? "waiting_expert" : "paid_no_expert",
    comment: "",
    files: {
      draft: state.withExpert ? null : "Запрос_Черновик.pdf",
      final: null,
      expertComment: null,
    },
  };
  state.documents.push(order);
  state.checkoutOrderId = id;
  alert(I18N[state.lang].alerts.orderCreated(id));
  render();
}

function addComment(postId, text) {
  addCommentLocal(postId, text);
}

function getLetterPreview() {
  const f = state.constructorForm;
  const chosenServices = Object.entries(f.services)
    .filter(([, v]) => v)
    .map(([k]) => {
      switch (k) {
        case "content":
          return "коммунальные услуги и содержание жилья";
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
    .join(", ");

  return `
${state.lang === "ru" ? "Управляющая компания:" : "Management company:"} ${f.ukName || "___________"}
${state.lang === "ru" ? "Адрес УК:" : "MC address:"} ${f.ukAddress || "___________"}

${state.lang === "ru" ? "От:" : "From:"} ${f.fullName || (state.lang === "ru" ? "ФИО: ___________" : "Full name: ___________")}
${state.lang === "ru" ? "Адрес:" : "Address:"} ${f.address || (state.lang === "ru" ? "Адрес: ___________" : "Address: ___________")}
${f.emailForReply ? (state.lang === "ru" ? "Email для ответа: " : "Email for reply: ") + f.emailForReply : ""}

${state.lang === "ru" ? "Запрос в порядке ст. 402-ФЗ" : "Request under Federal Law 402‑FZ"}

${state.lang === "ru" ? "Уважаемые представители управляющей компании!" : "Dear representatives of the management company,"}

${state.lang === "ru"
    ? "В соответствии с Федеральным законом № 402‑ФЗ «О бухгалтерском учёте» и действующим жилищным законодательством прошу предоставить документы и сведения, подтверждающие начисления и расходы по следующим услугам:"
    : "In accordance with Federal Law No. 402‑FZ \"On Accounting\" and the housing legislation in force, I request documents and information confirming charges and expenses for the following services:"}
${chosenServices || (state.lang === "ru" ? "перечень услуг будет указан здесь" : "the list of services will be specified here")}.

${state.lang === "ru"
    ? "Прошу предоставить расшифровку начислений за период:"
    : "Please provide a breakdown of charges for the period:"}
${f.period || (state.lang === "ru" ? "указать период" : "specify the period")}.

${state.lang === "ru"
    ? "Информацию прошу направить в письменном виде по адресу проживания и (или) на электронную почту, указанную в обращении."
    : "Please send the information in writing to my residential address and/or to the email address indicated in this request."}

${state.lang === "ru" ? "Дата, подпись." : "Date, signature."}
`.trim();
}

function render() {
  applyLanguageToShell();
  const hash = window.location.hash;
  if (hash === "#blog" || hash.startsWith("#blog/")) {
    renderBlog();
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

      <section id="legal" class="section section-legal">
        <div class="cards-row">
          <article class="neo-card" id="legal-offer">
            <h3 class="price-title">${tLegal.offerTitle}</h3>
            <p class="small muted-text">
              ${tLegal.offerBody}
            </p>
          </article>
          <article class="neo-card" id="legal-privacy">
            <h3 class="price-title">${tLegal.privacyTitle}</h3>
            <p class="small muted-text">
              ${tLegal.privacyBody}
            </p>
          </article>
        </div>
      </section>
    </div>
  `;

  // Обработчики конструктора
  const form = document.getElementById("constructor-form");
  if (form) {
    const bindField = (name) => {
      const el = form.elements?.[name] || form.querySelector(`[name="${name}"]`);
      if (el) el.addEventListener("input", (e) => updateConstructorField(name, e.target.value));
    };
    ["fullName", "address", "ukName", "ukAddress", "period", "emailForReply"].forEach(bindField);

    form.querySelectorAll("input[data-service]").forEach((input) => {
      input.addEventListener("change", (e) =>
        toggleService(e.target.getAttribute("data-service"))
      );
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
    btnCreateOrder.addEventListener("click", () => {
      const email =
        state.user?.email ||
        prompt(I18N[state.lang].alerts.enterEmail)?.trim();
      if (!email) return;
      if (!state.user) {
        setUser({ email });
      } else if (!state.user.email && email) {
        setUser({ ...state.user, email });
      }
      createOrder();
    });
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
      avatarEl.innerHTML = `<img src="${photoUrl}" alt="avatar">`;
    } else {
      avatarEl.innerHTML = `<span class="profile-avatar-letter">${firstLetter}</span>`;
    }
    
    contentEl.innerHTML = `
      <div class="profile-info">
        <div class="profile-info-avatar">
          ${photoUrl ? `<img src="${photoUrl}" alt="">` : firstLetter}
        </div>
        <div class="profile-info-text">
          <div class="profile-info-name">${state.user.first_name || 'Пользователь'}</div>
          ${state.user.username ? `<div class="profile-info-username">@${state.user.username}</div>` : ''}
        </div>
      </div>
      <button class="profile-menu-item" onclick="goToDashboard()">${state.lang === 'ru' ? 'Мои документы' : 'My documents'}</button>
      <button class="profile-menu-item logout" onclick="logout()">${state.lang === 'ru' ? 'Выйти' : 'Logout'}</button>
    `;
  } else {
    avatarEl.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    `;
    contentEl.innerHTML = `
      <div id="auth-telegram-widget">
        <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 12px; text-align: center;">
          ${state.lang === 'ru' ? 'Войдите через Telegram' : 'Log in with Telegram'}
        </p>
        <div id="tg-widget-container"></div>
      </div>
    `;
    const container = document.getElementById('tg-widget-container');
    if (container) {
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', 'k0nstruct_bot');
      script.setAttribute('data-size', 'medium');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      container.appendChild(script);
    }
  }
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
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
  alert(state.lang === 'ru' ? 'Личный кабинет в разработке' : 'Dashboard coming soon');
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

  window.addEventListener("hashchange", () => {
    render();
  });

  state.blogPosts = getDemoBlogPosts();
  initProfile();

  initAuth().then(() => render());
}

initShell();
