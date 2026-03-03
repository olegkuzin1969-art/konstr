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
    const resource = (query.resource || body.resource || 'orders').toString();
    const bodyWithQuery = req.method === 'GET'
      ? { initData: query.initData, resource }
      : { ...body, resource };
    const userId = await resolveUserId({ body: bodyWithQuery, headers: req.headers });

    if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (req.method === 'GET') {
      if (resource === 'balance_ops') {
        const { data, error } = await supabase
          .from('balance_operations')
          .select('id, amount_bye, type, meta, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ operations: data || [] });
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, data, approved, revision_comment, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ orders: (data || []).map(o => ({ ...o, revision_comment: o.revision_comment || '' })) });
    }

    if (req.method === 'POST') {
      if (resource !== 'orders') return res.status(400).json({ error: 'Unsupported resource' });
      const { data: orderData } = body;
      if (!orderData || typeof orderData !== 'object') return res.status(400).json({ error: 'Некорректные данные заказа' });
      const withExpert = !!orderData.withExpert;

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
        // fallback
      }

      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();
      if (userErr) return res.status(500).json({ error: userErr.message });
      const currentBalance = Number(userRow?.balance || 0);
      if (currentBalance < amountRub) {
        return res.status(400).json({ error: 'Недостаточно средств на балансе' });
      }

      const nextBalance = currentBalance - amountRub;
      const { error: balErr } = await supabase
        .from('users')
        .update({ balance: nextBalance })
        .eq('id', userId);
      if (balErr) return res.status(500).json({ error: balErr.message });

      const approved = withExpert ? null : true;
      const row = { user_id: userId, data: orderData, approved, revision_comment: '' };
      const { data: inserted, error } = await supabase.from('orders').insert(row).select().single();
      if (error) return res.status(500).json({ error: error.message });

      await supabase.from('balance_operations').insert({
        user_id: userId,
        amount_bye: -amountRub,
        type: 'order_payment',
        meta: { order_id: inserted.id || null, with_expert: withExpert },
      });

      return res.status(200).json({ order: inserted, balance: nextBalance });
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
      if (body.account || query.account === 'true') {
        // Полное удаление аккаунта и связанных данных пользователя
        const deletes = [];
        deletes.push(supabase.from('drafts').delete().eq('user_id', userId));
        deletes.push(supabase.from('orders').delete().eq('user_id', userId));
        deletes.push(supabase.from('blog_comments').delete().eq('user_id', userId));
        deletes.push(supabase.from('blog_posts').delete().eq('author_id', userId));

        const results = await Promise.all(deletes);
        for (const r of results) {
          if (r.error) {
            console.error('delete account step error:', r.error);
            return res.status(500).json({ error: 'Не удалось удалить аккаунт' });
          }
        }

        const { error: userErr } = await supabase.from('users').delete().eq('id', userId);
        if (userErr) {
          console.error('delete account user error:', userErr);
          return res.status(500).json({ error: 'Не удалось удалить аккаунт' });
        }

        return res.status(200).json({ ok: true });
      }

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
