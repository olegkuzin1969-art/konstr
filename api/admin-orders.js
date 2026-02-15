const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);

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

async function resolveUserAndTelegramId(req) {
  const body = req.body || {};
  const initData = body.initData || req.query?.initData;
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let userId = null;
  let telegramId = null;

  if (initData && verifyInitData(initData)) {
    const tgUser = parseUserFromInitData(initData);
    if (tgUser?.id) telegramId = tgUser.id;
  }
  if (token) {
    userId = verifySessionToken(token);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  if (!userId && telegramId) {
    const { data: row } = await supabase.from('users').select('id').eq('telegram_id', telegramId).single();
    userId = row?.id ?? null;
  }
  if (userId && !telegramId) {
    const { data: row } = await supabase.from('users').select('telegram_id').eq('id', userId).single();
    telegramId = row?.telegram_id ?? null;
  }
  return { userId, telegramId };
}

function isAdmin(telegramId) {
  if (!telegramId) return false;
  return ADMIN_TELEGRAM_IDS.some(id => String(id) === String(telegramId));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Server config error' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const query = req.query || {};
    const reqWithQuery = { ...req, body: req.method === 'GET' ? {} : body, query };
    const { userId, telegramId } = await resolveUserAndTelegramId({
      body: req.method === 'GET' ? { initData: query.initData } : body,
      query,
      headers: req.headers,
    });

    if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });
    if (!isAdmin(telegramId)) return res.status(403).json({ error: 'Доступ запрещён' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (req.method === 'GET') {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, data, approved, revision_comment, created_at, user_id')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });

      const userIds = [...new Set((orders || []).map(o => o.user_id).filter(Boolean))];
      const { data: users } = userIds.length > 0
        ? await supabase.from('users').select('id, first_name, last_name, username, telegram_id').in('id', userIds)
        : { data: [] };
      const userMap = (users || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});

      const rows = (orders || []).map(o => ({
        id: o.id,
        data: o.data,
        approved: o.approved,
        revision_comment: o.revision_comment || '',
        created_at: o.created_at,
        user: userMap[o.user_id] || null,
      }));
      return res.status(200).json({ orders: rows });
    }

    if (req.method === 'PATCH') {
      const { id, approved, revision_comment } = body;
      if (!id) return res.status(400).json({ error: 'id обязателен' });
      if (approved === undefined && revision_comment === undefined) return res.status(400).json({ error: 'Укажите approved или revision_comment' });

      const update = {};
      if (approved !== undefined) update.approved = approved;
      const commentVal = revision_comment !== undefined ? String(revision_comment || '').trim() : undefined;
      if (commentVal !== undefined) update.revision_comment = commentVal;
      if (approved === false && (!commentVal || commentVal === '')) {
        return res.status(400).json({ error: 'При статусе "на доработку" обязателен комментарий' });
      }
      if (approved === true) update.revision_comment = '';

      const { data: updated, error } = await supabase
        .from('orders')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      if (!updated) return res.status(404).json({ error: 'Заказ не найден' });
      return res.status(200).json({ order: updated });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('admin-orders error:', err);
    return res.status(500).json({ error: err.message });
  }
};
