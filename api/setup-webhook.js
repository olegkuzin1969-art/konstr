/**
 * Установка webhook для Telegram бота
 * Вызови после деплоя: GET https://твой-домен.vercel.app/api/setup-webhook
 * Добавь BOT_TOKEN и VERCEL_URL в переменные окружения Vercel
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN;
  const VERCEL_URL = process.env.VERCEL_URL; // Vercel подставляет автоматически

  if (!BOT_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'BOT_TOKEN not set. Add it in Vercel Environment Variables.'
    });
  }

  const baseUrl = VERCEL_URL
    ? `https://${VERCEL_URL}`
    : process.env.URL || req.headers['x-forwarded-host'] || '';

  if (!baseUrl) {
    return res.status(500).json({
      ok: false,
      error: 'Cannot determine deployment URL. Deploy first, then call this endpoint.'
    });
  }

  const webhookUrl = `${baseUrl}/api/webhook`;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });
    const data = await response.json();

    if (!data.ok) {
      return res.status(400).json({
        ok: false,
        error: data.description || 'setWebhook failed',
        telegram_response: data
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Webhook registered',
      webhook_url: webhookUrl
    });
  } catch (err) {
    console.error('Setup webhook error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
