const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_EMAIL = 'henson1330@gmail.com';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { name, email, message } = body;

    if (!name || !message) {
      return res.status(400).json({ error: 'Укажите имя и сообщение' });
    }

    const resend = new Resend(RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: 'Конструкт <onboarding@resend.dev>',
      to: [CONTACT_EMAIL],
      replyTo: email || undefined,
      subject: `Обратная связь: ${(name || '').slice(0, 50)}`,
      html: `
        <p><strong>От:</strong> ${escapeHtml(name || '—')}</p>
        <p><strong>Email:</strong> ${escapeHtml(email || 'не указан')}</p>
        <p><strong>Сообщение:</strong></p>
        <p>${escapeHtml(message || '').replace(/\n/g, '<br>')}</p>
      `,
    });

    if (error) {
      console.error('contact email error:', error);
      return res.status(500).json({ error: error.message || 'Ошибка отправки' });
    }

    return res.status(200).json({ ok: true, id: data?.id });
  } catch (err) {
    console.error('contact error:', err);
    return res.status(500).json({ error: err.message || 'Ошибка сервера' });
  }
};

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
