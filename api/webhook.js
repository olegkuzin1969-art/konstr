const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not set' });

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const msg = update?.message;
    if (!msg) return res.status(200).json({ ok: true });

    const text = (msg.text || '').trim().toLowerCase();
    const chatId = msg.chat.id;

    if (text === '/start') {
      const t = BASE_URL
        ? `Привет! 👋\n\nСервис «Конструкт» — помогаю собрать официальный запрос в управляющую компанию по 402-ФЗ.\n\n📋 Выберите действие:\n\n<em>Для входа на сайт: /login</em>`
        : `Привет! 👋\n\nСервис «Конструкт» — помогаю собрать официальный запрос в управляющую компанию по 402-ФЗ.\n\n🔐 Чтобы войти на сайт: отправь /login`;
      const menu = BASE_URL ? {
        inline_keyboard: [[{ text: '📝 Создать запрос', web_app: { url: BASE_URL } }]],
      } : undefined;
      await sendMessage(chatId, t, menu ? { reply_markup: menu } : {});
      return res.status(200).json({ ok: true });
    }

    if (text === '/menu' && BASE_URL) {
      const menu = {
        inline_keyboard: [[{ text: '📝 Создать запрос', web_app: { url: BASE_URL } }]],
      };
      await sendMessage(chatId, 'Выберите действие:', { reply_markup: menu });
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
