const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Server config error' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const query = req.query || {};
    const bodyWithQuery = req.method === 'GET' ? { initData: query.initData } : body;
    const userId = await resolveUserId({ body: bodyWithQuery, headers: req.headers });

    if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('orders')
        .select('id, data, approved, revision_comment, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ orders: (data || []).map(o => ({ ...o, revision_comment: o.revision_comment || '' })) });
    }

    if (req.method === 'POST') {
      const { data: orderData } = body;
      if (!orderData || typeof orderData !== 'object') return res.status(400).json({ error: 'Некорректные данные заказа' });
      const withExpert = !!orderData.withExpert;
      // Без проверки — сразу approved=true (можно скачать). С проверкой — approved=null (в работе).
      const approved = withExpert ? null : true;
      const row = { user_id: userId, data: orderData, approved, revision_comment: '' };
      const { data: inserted, error } = await supabase.from('orders').insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ order: inserted });
    }

    if (req.method === 'PUT') {
      const { id, data: orderData } = body;
      if (!id || !orderData || typeof orderData !== 'object') return res.status(400).json({ error: 'Некорректные данные' });
      // Обновление заказа (при доработке): данные и сброс approved на null
      const { data: updated, error } = await supabase
        .from('orders')
        .update({ data: orderData, approved: null, revision_comment: '' })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      if (!updated) return res.status(404).json({ error: 'Заказ не найден' });
      return res.status(200).json({ order: updated });
    }

    if (req.method === 'DELETE') {
      const id = body.id || query.id;
      if (!id) return res.status(400).json({ error: 'id обязателен' });
      const { error } = await supabase.from('orders').delete().eq('id', id).eq('user_id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('orders error:', err);
    return res.status(500).json({ error: err.message });
  }
};
