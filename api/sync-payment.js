const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Server config error' });
  if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) return res.status(500).json({ error: 'YooKassa not configured' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const userId = await resolveUserId({ body, headers: req.headers });
    if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: intents } = await supabase
      .from('payment_intents')
      .select('id, user_id, order_data, with_expert, yookassa_payment_id, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .not('yookassa_payment_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!intents || intents.length === 0) {
      return res.status(200).json({ synced: false });
    }

    const auth = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');

    for (const intent of intents) {
      if (!intent.yookassa_payment_id) continue;
      const yooRes = await fetch(`https://api.yookassa.ru/v3/payments/${intent.yookassa_payment_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const payment = await yooRes.json().catch(() => ({}));
      if (payment.status !== 'succeeded') continue;

      // Атомарно забираем intent (только если всё ещё pending), чтобы не создать заказ дважды с вебхуком
      const { data: lockedRows, error: lockErr } = await supabase
        .from('payment_intents')
        .update({ status: 'completed' })
        .eq('id', intent.id)
        .eq('status', 'pending')
        .select('id');
      if (lockErr || !lockedRows || lockedRows.length === 0) continue;

      const approved = intent.with_expert ? null : true;
      const { error: orderError } = await supabase.from('orders').insert({
        user_id: intent.user_id,
        data: intent.order_data,
        approved,
        revision_comment: '',
      });
      if (orderError) {
        console.error('sync-payment order insert:', orderError);
        await supabase.from('payment_intents').update({ status: 'pending' }).eq('id', intent.id);
        continue;
      }
      return res.status(200).json({ synced: true });
    }

    return res.status(200).json({ synced: false });
  } catch (err) {
    console.error('sync-payment error:', err);
    return res.status(500).json({ error: err.message });
  }
};
