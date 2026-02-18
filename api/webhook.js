const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

function genCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function sendMessage(chatId, text, extra = {}) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
}

function answerCallbackQuery(callbackQueryId, text) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

async function getUserPhotoPath(userId) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUserProfilePhotos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, limit: 1 }),
    });
    const data = await r.json();
    if (!data.ok || !data.result?.photos?.length) return null;
    const sizes = data.result.photos[0];
    const largest = sizes[sizes.length - 1];
    const fr = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: largest.file_id }),
    });
    const fileData = await fr.json();
    if (!fileData.ok || !fileData.result?.file_path) return null;
    return fileData.result.file_path;
  } catch {
    return null;
  }
}

async function sendMyDocuments(chatId, telegramId) {
  if (!telegramId) {
    await sendMessage(chatId, 'Не удалось определить пользователя. Откройте приложение по кнопке «Создать запрос» и войдите.');
    return;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);
  const { data: user, error: userErr } = await supabase.from('users').select('id').eq('telegram_id', String(telegramId)).single();
  if (userErr || !user) {
    await sendMessage(chatId, 'Сначала войдите на сайт или откройте приложение по кнопке «Создать запрос» один раз.', BASE_URL ? {
      reply_markup: { inline_keyboard: [[{ text: '📝 Открыть приложение', web_app: { url: BASE_URL } }]] },
    } : {});
    return;
  }
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id, data, approved, revision_comment, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (ordersErr) {
    await sendMessage(chatId, 'Не удалось загрузить документы. Попробуйте позже.');
    return;
  }
  if (!orders || orders.length === 0) {
    await sendMessage(chatId, 'У вас пока нет документов. Создайте запрос по кнопке «Создать запрос».', BASE_URL ? {
      reply_markup: { inline_keyboard: [[{ text: '📝 Создать запрос', web_app: { url: BASE_URL } }]] },
    } : {});
    return;
  }
  const profileUrl = BASE_URL ? `${BASE_URL}/#profile` : '';
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString('ru-RU') : '';
    let statusText = '';
    let hint = '';
    let row = [];
    if (o.approved === true) {
      statusText = '✅ Готов';
      hint = 'Можно скачать документ в приложении.';
      if (profileUrl) row.push({ text: '📥 Открыть и скачать', web_app: { url: profileUrl } });
    } else if (o.approved === false) {
      statusText = '✏️ На доработке';
      hint = 'Эксперт отправил документ на доработку. Перейдите в приложение для повторного заполнения.';
      if (o.revision_comment) hint += `\n\nКомментарий эксперта: ${o.revision_comment}`;
      if (profileUrl) row.push({ text: '📝 Перейти в приложение', web_app: { url: profileUrl } });
    } else {
      statusText = '⏳ В работе';
      hint = 'Дождитесь проверки экспертом.';
    }
    const text = `<b>Документ ${i + 1}</b> (${dateStr})\nСтатус: ${statusText}\n\n${hint}`;
    await sendMessage(chatId, text, row.length ? { reply_markup: { inline_keyboard: [row] } } : {});
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not set' });

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const callback = update?.callback_query;
    if (callback) {
      const chatId = callback.message?.chat?.id;
      const telegramId = callback.from?.id;
      const data = callback.data;
      if (data === 'mydocs' && chatId && SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)) {
        await answerCallbackQuery(callback.id);
        await sendMyDocuments(chatId, telegramId);
      }
      return res.status(200).json({ ok: true });
    }

    const msg = update?.message;
    if (!msg) return res.status(200).json({ ok: true });

    const text = (msg.text || '').trim().toLowerCase();
    const chatId = msg.chat.id;

    if (text === '/start') {
      const t = BASE_URL
        ? `Привет! 👋\n\nСервис «Конструктор официальных обращений» — помогаю собрать официальный запрос в управляющую компанию.\n\n<em>Для входа на сайт: /login</em>`
        : `Привет! 👋\n\nСервис «Конструктор официальных обращений» — помогаю собрать официальный запрос в управляющую компанию.\n\n🔐 Чтобы войти на сайт: отправь /login`;
      const menu = BASE_URL ? {
        inline_keyboard: [
          [{ text: '📝 Создать запрос', web_app: { url: BASE_URL } }],
          [{ text: '📋 Мои документы', callback_data: 'mydocs' }],
        ],
      } : undefined;
      await sendMessage(chatId, t, menu ? { reply_markup: menu } : {});
      return res.status(200).json({ ok: true });
    }

    if (text === '/menu' && BASE_URL) {
      const menu = {
        inline_keyboard: [
          [{ text: '📝 Создать запрос', web_app: { url: BASE_URL } }],
          [{ text: '📋 Мои документы', callback_data: 'mydocs' }],
        ],
      };
      await sendMessage(chatId, 'Выберите действие:', { reply_markup: menu });
      return res.status(200).json({ ok: true });
    }

    if ((text === 'мои документы' || text === '/docs') && SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)) {
      await sendMyDocuments(chatId, msg.from?.id);
      return res.status(200).json({ ok: true });
    }

    if (text === '/login' && SUPABASE_URL && SUPABASE_ANON_KEY) {
      const from = msg.from;
      if (!from) return res.status(200).json({ ok: true });

      const photoPath = await getUserPhotoPath(from.id);
      const code = genCode();
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await supabase.from('login_codes').insert({
        code,
        telegram_id: from.id,
        first_name: from.first_name || null,
        last_name: from.last_name || null,
        username: from.username || null,
        photo_url: photoPath || null,
      });

      const link = `${BASE_URL || 'https://твой-сайт.vercel.app'}?code=${code}`;
      await sendMessage(chatId, `🔐 Код для входа: <code>${code}</code>\n\nДействует 5 минут.\n\nПерейди по ссылке или введи код на сайте:\n${link}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ ok: true });
  }
};
