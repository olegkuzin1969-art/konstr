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

async function isAdmin(supabase, userId) {
  if (!userId) return false;
  const { data } = await supabase.from('users').select('administrator').eq('id', userId).single();
  return !!data?.administrator;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'PATCH', 'POST', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Server config error' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const query = req.query || {};
    const resource = (query.resource || body.resource || 'orders').toString();
    const { userId } = await resolveUserAndTelegramId({
      body: req.method === 'GET' ? { initData: query.initData } : body,
      query,
      headers: req.headers,
    });

    if (!userId) return res.status(401).json({ error: 'Необходима авторизация' });

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!(await isAdmin(supabase, userId))) return res.status(403).json({ error: 'Доступ запрещён' });

    // ===== Template variables CRUD (таблица: template_variables) =====
    if (resource === 'variables') {
      if (req.method === 'GET') {
        const { data: rows, error } = await supabase
          .from('template_variables')
          .select('id, key, label_ru, label_en, is_active, sort_order, created_at, updated_at')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ variables: rows || [] });
      }

      if (req.method === 'POST') {
        const v = body.variable || body;
        const key = String(v.key || '').trim();
        if (!key) return res.status(400).json({ error: 'key обязателен' });
        const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
        const row = {
          key: safeKey,
          label_ru: String(v.label_ru || '').trim(),
          label_en: String(v.label_en || '').trim(),
          is_active: v.is_active !== undefined ? !!v.is_active : true,
          sort_order: parseInt(v.sort_order, 10) || 0,
          updated_at: new Date().toISOString(),
        };
        const { data: created, error } = await supabase.from('template_variables').insert(row).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ variable: created });
      }

      if (req.method === 'PUT') {
        const id = body.id;
        if (!id) return res.status(400).json({ error: 'id обязателен' });
        const patch = body.variable || body;
        const update = { updated_at: new Date().toISOString() };
        if (patch.key !== undefined) update.key = String(patch.key || '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
        if (patch.label_ru !== undefined) update.label_ru = String(patch.label_ru || '').trim();
        if (patch.label_en !== undefined) update.label_en = String(patch.label_en || '').trim();
        if (patch.is_active !== undefined) update.is_active = !!patch.is_active;
        if (patch.sort_order !== undefined) update.sort_order = parseInt(patch.sort_order, 10) || 0;
        if (update.key !== undefined && !update.key) return res.status(400).json({ error: 'key не может быть пустым' });

        const { data: updated, error } = await supabase.from('template_variables').update(update).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        if (!updated) return res.status(404).json({ error: 'Переменная не найдена' });
        return res.status(200).json({ variable: updated });
      }

      if (req.method === 'DELETE') {
        const id = body.id || query.id;
        if (!id) return res.status(400).json({ error: 'id обязателен' });
        const { error } = await supabase.from('template_variables').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      return res.status(405).end();
    }

    // ===== Templates CRUD (таблица: name, description, header_ru/en, title_ru/en, body_ru/en, is_active, sort_order) =====
    if (resource === 'templates') {
      if (req.method === 'GET') {
        const { data: rows, error } = await supabase
          .from('templates')
          .select('id, name, description, header_ru, header_en, title_ru, title_en, body_ru, body_en, is_active, sort_order, created_at, updated_at')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        const templates = (rows || []).map((row) => ({
          ...row,
          content: {
            header: { ru: row.header_ru || '', en: row.header_en || '' },
            title: { ru: row.title_ru || '', en: row.title_en || '' },
            body: { ru: row.body_ru || '', en: row.body_en || '' },
          },
        }));
        return res.status(200).json({ templates });
      }

      if (req.method === 'POST') {
        const tpl = body.template || body;
        const name = String(tpl.name || '').trim();
        if (!name) return res.status(400).json({ error: 'name обязателен' });
        const row = {
          name,
          description: String(tpl.description || ''),
          header_ru: String(tpl.header_ru ?? (tpl.content?.header?.ru ?? '')).trim(),
          header_en: String(tpl.header_en ?? (tpl.content?.header?.en ?? '')).trim(),
          title_ru: String(tpl.title_ru ?? (tpl.content?.title?.ru ?? '')).trim(),
          title_en: String(tpl.title_en ?? (tpl.content?.title?.en ?? '')).trim(),
          body_ru: String(tpl.body_ru ?? (tpl.content?.body?.ru ?? '')),
          body_en: String(tpl.body_en ?? (tpl.content?.body?.en ?? '')),
          is_active: tpl.is_active !== undefined ? !!tpl.is_active : true,
          sort_order: parseInt(tpl.sort_order, 10) || 0,
          updated_at: new Date().toISOString(),
        };
        const { data: created, error } = await supabase.from('templates').insert(row).select().single();
        if (error) return res.status(500).json({ error: error.message });
        const out = {
          ...created,
          content: {
            header: { ru: created.header_ru || '', en: created.header_en || '' },
            title: { ru: created.title_ru || '', en: created.title_en || '' },
            body: { ru: created.body_ru || '', en: created.body_en || '' },
          },
        };
        return res.status(200).json({ template: out });
      }

      if (req.method === 'PUT') {
        const id = body.id;
        if (!id) return res.status(400).json({ error: 'id обязателен' });
        const patch = body.template || body;
        const update = { updated_at: new Date().toISOString() };
        if (patch.name !== undefined) update.name = String(patch.name || '').trim();
        if (patch.description !== undefined) update.description = String(patch.description || '');
        if (patch.header_ru !== undefined) update.header_ru = String(patch.header_ru ?? (patch.content?.header?.ru ?? ''));
        if (patch.header_en !== undefined) update.header_en = String(patch.header_en ?? (patch.content?.header?.en ?? ''));
        if (patch.title_ru !== undefined) update.title_ru = String(patch.title_ru ?? (patch.content?.title?.ru ?? ''));
        if (patch.title_en !== undefined) update.title_en = String(patch.title_en ?? (patch.content?.title?.en ?? ''));
        if (patch.body_ru !== undefined) update.body_ru = String(patch.body_ru ?? (patch.content?.body?.ru ?? ''));
        if (patch.body_en !== undefined) update.body_en = String(patch.body_en ?? (patch.content?.body?.en ?? ''));
        if (patch.is_active !== undefined) update.is_active = !!patch.is_active;
        if (patch.sort_order !== undefined) update.sort_order = parseInt(patch.sort_order, 10) || 0;
        if (update.name !== undefined && !update.name) return res.status(400).json({ error: 'name не может быть пустым' });

        const { data: updated, error } = await supabase.from('templates').update(update).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        if (!updated) return res.status(404).json({ error: 'Шаблон не найден' });
        const out = {
          ...updated,
          content: {
            header: { ru: updated.header_ru || '', en: updated.header_en || '' },
            title: { ru: updated.title_ru || '', en: updated.title_en || '' },
            body: { ru: updated.body_ru || '', en: updated.body_en || '' },
          },
        };
        return res.status(200).json({ template: out });
      }

      if (req.method === 'DELETE') {
        const id = body.id || query.id;
        if (!id) return res.status(400).json({ error: 'id обязателен' });
        const { error } = await supabase.from('templates').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      return res.status(405).end();
    }

    // ===== Pricing (таблица: pricing, одна строка с ценами) =====
    if (resource === 'pricing') {
      if (req.method === 'GET') {
        const { data: row, error } = await supabase
          .from('pricing')
          .select('id, base_price_rub, expert_price_rub, updated_at')
          .eq('id', 1)
          .single();
        if (error && error.code !== 'PGRST116') {
          return res.status(500).json({ error: error.message });
        }
        if (!row) {
          const { data: created, error: insertError } = await supabase
            .from('pricing')
            .insert({ id: 1, base_price_rub: 700, expert_price_rub: 2200 })
            .select('id, base_price_rub, expert_price_rub, updated_at')
            .single();
          if (insertError) return res.status(500).json({ error: insertError.message });
          return res.status(200).json({ pricing: created });
        }
        return res.status(200).json({ pricing: row });
      }

      if (req.method === 'PUT') {
        const p = body.pricing || body;
        const base = Number(p.base_price_rub);
        const expert = Number(p.expert_price_rub);
        if (!Number.isFinite(base) || base <= 0 || !Number.isInteger(base)) {
          return res.status(400).json({ error: 'Некорректная цена базового тарифа' });
        }
        if (!Number.isFinite(expert) || expert <= 0 || !Number.isInteger(expert)) {
          return res.status(400).json({ error: 'Некорректная цена тарифа с экспертом' });
        }
        const { data: updated, error } = await supabase
          .from('pricing')
          .update({ base_price_rub: base, expert_price_rub: expert, updated_at: new Date().toISOString() })
          .eq('id', 1)
          .select('id, base_price_rub, expert_price_rub, updated_at')
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ pricing: updated });
      }

      return res.status(405).end();
    }

    // ===== Appearance (таблица: appearance, тема/цвета сайта) =====
    if (resource === 'appearance') {
      if (req.method === 'GET') {
        const { data: row, error } = await supabase
          .from('appearance')
          .select('id, bg_color, bg_elevated_color, bg_gradient_from, bg_gradient_to, accent_color, border_color, updated_at')
          .eq('id', 1)
          .single();
        if (error && error.code !== 'PGRST116') {
          return res.status(500).json({ error: error.message });
        }
        return res.status(200).json({ appearance: row || null });
      }

      if (req.method === 'PUT') {
        const a = body.appearance || body;
        const row = {
          bg_color: a.bg_color ? String(a.bg_color).trim() : null,
          bg_elevated_color: a.bg_elevated_color ? String(a.bg_elevated_color).trim() : null,
          bg_gradient_from: a.bg_gradient_from ? String(a.bg_gradient_from).trim() : null,
          bg_gradient_to: a.bg_gradient_to ? String(a.bg_gradient_to).trim() : null,
          accent_color: a.accent_color ? String(a.accent_color).trim() : null,
          border_color: a.border_color ? String(a.border_color).trim() : null,
          updated_at: new Date().toISOString(),
        };
        const { data: updated, error } = await supabase
          .from('appearance')
          .upsert({ id: 1, ...row })
          .select('id, bg_color, bg_elevated_color, bg_gradient_from, bg_gradient_to, accent_color, border_color, updated_at')
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ appearance: updated });
      }

      if (req.method === 'DELETE') {
        const { error } = await supabase.from('appearance').delete().eq('id', 1);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      return res.status(405).end();
    }

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
