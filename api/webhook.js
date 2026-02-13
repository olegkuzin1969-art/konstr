/**
 * Telegram webhook handler для Vercel Serverless
 * Принимает обновления от Telegram и обрабатывает команды
 */

const BOT_TOKEN = process.env.BOT_TOKEN;

async function sendMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function getStartMessage() {
  return `Привет! 👋

<b>Сервис «Конструкт»</b> — помогаю собрать официальный запрос в управляющую компанию по 402-ФЗ.

📋 <b>Что умею:</b>
• Открой мини-приложение и заполняй форму по шагам
• Получишь черновик письма
• Сгенерирую готовый PDF для отправки в УК`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN not set');
    return res.status(500).json({ ok: false, error: 'Server config error' });
  }

  try {
    const update = req.body;
    
    // Реагируем только на сообщения
    const message = update.message;
    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = (message.text || '').trim();

    if (text === '/start') {
      await sendMessage(chatId, getStartMessage());
    }
    // Можно добавить обработку других команд и inline кнопок позже

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ ok: true }); // Telegram ожидает 200 при любом ответе
  }
}
