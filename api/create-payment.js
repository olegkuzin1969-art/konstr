const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

function verifyInitData(initData) {
  if (!initData || !BOT_TOKEN) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return calculated === hash;
}

function parseUserFromInitData(initData) {
  const params = new URLSearchParams(initData);
  const userStr = params.get('user');
  if (!userStr) return null;
  try {
    return JSON.parse(decodeURIComponent(userStr));
  } catch {
    return null;
  }
}

function verifySessionToken(token) {
  if (!token || !BOT_TOKEN) return null;
  try {
    const [headerB64, payloadB64, sig] = token.split('.');
    if (!headerB64 || !payloadB64 || !sig) return null;
    const expected = crypto.createHmac('sha256', BOT_TOKEN).update(`${headerB64}.${payloadB64}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

async function resolveUserId(req) {
  const body = req.body || {};
  const initData = body.initData;
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (initData && verifyInitData(initData)) {
    const tgUser = parseUserFromInitData(initData);
    if (!tgUser?.id) return null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: row } = await supabase.from('users').select('id').eq('telegram_id', tgUser.id).single();
    return row?.id ?? null;
  }
  if (token) return verifySessionToken(token);
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
    return res.status(500).json({ error: 'Оплата не настроена (YooKassa)' });
  }
  if (!BASE_URL) return res.status(500).json({ error: 'BASE_URL не задан' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Server config error' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const userId = await resolveUserId({ body, headers: req.headers });
    if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

    const orderData = body.orderData;
    const withExpert = !!body.withExpert;
    if (!orderData || typeof orderData !== 'object') return res.status(400).json({ error: 'Некорректные данные заказа' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let amountRub = withExpert ? 2200 : 700;
    try {
      const { data: pricingRow } = await supabase
        .from('pricing')
        .select('base_price_rub, expert_price_rub')
        .eq('id', 1)
        .single();
      if (pricingRow) {
        const base = Number(pricingRow.base_price_rub);
        const expert = Number(pricingRow.expert_price_rub);
        if (Number.isFinite(base) && base > 0 && Number.isInteger(base) &&
            Number.isFinite(expert) && expert > 0 && Number.isInteger(expert)) {
          amountRub = withExpert ? expert : base;
        }
      }
    } catch {
      // fallback to default prices if pricing not available
    }

    const amountKop = amountRub * 100;
    const valueStr = amountRub.toFixed(2);
    const { data: intent, error: insertError } = await supabase
      .from('payment_intents')
      .insert({
        user_id: userId,
        order_data: { ...orderData, withExpert },
        with_expert: withExpert,
        amount_kop: amountKop,
        status: 'pending',
      })
      .select('id')
      .single();
    if (insertError || !intent) return res.status(500).json({ error: insertError?.message || 'Ошибка создания намерения' });

    const returnUrl = `${BASE_URL}/?payment=success`;
    const idempotenceKey = crypto.randomUUID();
    const auth = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

    const customerEmail = body.receiptEmail && String(body.receiptEmail).trim();
    if (!customerEmail) {
      return res.status(400).json({ error: 'Укажите email для чека в модальном окне перед оплатой.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({ error: 'Укажите корректный email для чека (например example@mail.ru).' });
    }

    const receipt = {
      customer: { email: customerEmail },
      items: [
        {
          description: withExpert ? 'Запрос в УК с проверкой эксперта' : 'Запрос в УК ст. 165 ЖК РФ',
          quantity: '1',
          amount: { value: valueStr, currency: 'RUB' },
          vat_code: 1,
          payment_subject: 'service',
          payment_mode: 'full_payment',
        },
      ],
    };

    const yookassaBody = {
      amount: { value: valueStr, currency: 'RUB' },
      capture: true,
      confirmation: { type: 'redirect', return_url: returnUrl },
      description: 'Заказ запроса ст. 165 ЖК РФ',
      metadata: { payment_intent_id: intent.id },
      receipt,
    };

    const yooRes = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(yookassaBody),
    });
    const yooData = await yooRes.json().catch(() => ({}));

    if (!yooRes.ok) {
      return res.status(502).json({ error: yooData.description || 'Ошибка ЮKassa' });
    }
    const confirmationUrl = yooData.confirmation?.confirmation_url;
    const yooPaymentId = yooData.id;
    if (!confirmationUrl) return res.status(502).json({ error: 'Нет ссылки на оплату' });

    await supabase
      .from('payment_intents')
      .update({ yookassa_payment_id: yooPaymentId })
      .eq('id', intent.id);

    return res.status(200).json({ confirmation_url: confirmationUrl });
  } catch (err) {
    console.error('create-payment error:', err);
    return res.status(500).json({ error: err.message });
  }
};
