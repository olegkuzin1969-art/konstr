const BOT_TOKEN = process.env.BOT_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not set' });

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const msg = update?.message;
    
    // Логируем для отладки
    console.log('Received update:', JSON.stringify(update));
    
    if (!msg || !msg.text) {
      return res.status(200).json({ ok: true });
    }
    
    const command = msg.text.trim().toLowerCase();
    if (command !== '/start') {
      return res.status(200).json({ ok: true });
    }

    const appUrl = process.env.BASE_URL ? `${process.env.BASE_URL.replace(/\/$/, '')}` : '';
    const text = appUrl
      ? `Привет! 👋\n\nСервис «Конструкт» — помогаю собрать официальный запрос в управляющую компанию по 402-ФЗ. Открывай мини-приложение и заполняй форму по шагам: получишь черновик письма и готовый PDF.\n\n📋 Мини-приложение: ${appUrl}`
      : 'Привет! 👋\n\nСервис «Конструкт» — помогаю собрать официальный запрос в управляющую компанию по 402-ФЗ. Открывай мини-приложение и заполняй форму по шагам: получишь черновик письма и готовый PDF.';

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: msg.chat.id,
        text,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();
    console.log('Send message result:', result);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error in webhook:', err);
    return res.status(200).json({ ok: true });
  }
};
