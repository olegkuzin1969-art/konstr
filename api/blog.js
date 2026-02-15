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
  const initData = body.initData || req.query?.initData;
  const authHeader = req.headers?.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (initData && verifyInitData(initData)) {
    const tgUser = parseUserFromInitData(initData);
    if (!tgUser?.id) return null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: row } = await supabase.from('users').select('id, first_name, username').eq('telegram_id', tgUser.id).single();
    return row ? { id: row.id, name: row.first_name || row.username || 'User' } : null;
  }
  if (token) {
    const userId = verifySessionToken(token);
    if (!userId) return null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: row } = await supabase.from('users').select('id, first_name, username').eq('id', userId).single();
    return row ? { id: row.id, name: row.first_name || row.username || 'User' } : null;
  }
  return null;
}

async function isAdmin(supabase, userId) {
  if (!userId) return false;
  const { data } = await supabase.from('users').select('administrator').eq('id', userId).single();
  return !!data?.administrator;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Server config error' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const query = req.query || {};
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    if (req.method === 'GET') {
      const postId = query.postId || query.post;
      if (postId) {
        const { data: comments, error } = await supabase
          .from('blog_comments')
          .select('id, user_id, author_name, text, created_at')
          .eq('post_id', postId)
          .order('created_at', { ascending: true });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ comments: comments || [] });
      }
      const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('id, title_ru, title_en, body_ru, body_en, media, created_at')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ posts: posts || [] });
    }

    if (req.method === 'POST') {
      if (body.postId && body.text !== undefined) {
        const user = await resolveUserId({ body, headers: req.headers });
        if (!user) return res.status(401).json({ error: 'Войдите, чтобы комментировать' });
        const text = String(body.text || '').trim();
        if (!text) return res.status(400).json({ error: 'Введите текст комментария' });
        const { data: comment, error } = await supabase
          .from('blog_comments')
          .insert({ post_id: body.postId, user_id: user.id, author_name: user.name || 'User', text })
          .select()
          .single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ comment });
      }

      if (body.title_ru !== undefined || body.title_en !== undefined) {
        const user = await resolveUserId({ body, headers: req.headers });
        if (!user) return res.status(401).json({ error: 'Необходима авторизация' });
        if (!(await isAdmin(supabase, user.id))) return res.status(403).json({ error: 'Только админ может создавать посты' });
        const title_ru = String(body.title_ru || '').trim();
        const title_en = String(body.title_en || '').trim();
        const body_ru = String(body.body_ru || '').trim();
        const body_en = String(body.body_en || '').trim();
        const media = Array.isArray(body.media) ? body.media : [];
        if (!title_ru && !title_en) return res.status(400).json({ error: 'Укажите заголовок' });
        const row = {
          author_id: user.id,
          title_ru: title_ru || title_en || 'Post',
          title_en: title_en || title_ru || 'Post',
          body_ru: body_ru || body_en || '',
          body_en: body_en || body_ru || '',
          media: media.filter(m => m && (m.url || m.src)).map(m => ({ type: m.type || 'photo', url: m.url || m.src })),
          updated_at: new Date().toISOString(),
        };
        const { data: post, error } = await supabase.from('blog_posts').insert(row).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ post });
      }

      return res.status(400).json({ error: 'Некорректный запрос' });
    }

    if (req.method === 'PUT') {
      const user = await resolveUserId({ body, headers: req.headers });
      if (!user) return res.status(401).json({ error: 'Необходима авторизация' });

      if (body.commentId && body.text !== undefined) {
        const { data: existing } = await supabase.from('blog_comments').select('user_id').eq('id', body.commentId).single();
        if (!existing || existing.user_id !== user.id) return res.status(403).json({ error: 'Можно редактировать только свои комментарии' });
        const text = String(body.text || '').trim();
        if (!text) return res.status(400).json({ error: 'Введите текст' });
        const { data: comment, error } = await supabase.from('blog_comments').update({ text }).eq('id', body.commentId).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ comment });
      }

      if (!(await isAdmin(supabase, user.id))) return res.status(403).json({ error: 'Только админ может редактировать посты' });
      const id = body.id;
      if (!id) return res.status(400).json({ error: 'Укажите id поста' });
      const title_ru = String(body.title_ru ?? '').trim();
      const title_en = String(body.title_en ?? '').trim();
      const body_ru = String(body.body_ru ?? '').trim();
      const body_en = String(body.body_en ?? '').trim();
      const media = Array.isArray(body.media) ? body.media : [];
      const row = {
        updated_at: new Date().toISOString(),
        title_ru: title_ru || title_en || 'Post',
        title_en: title_en || title_ru || 'Post',
        body_ru: body_ru || body_en || '',
        body_en: body_en || body_ru || '',
        media: media.filter(m => m && (m.url || m.src)).map(m => ({ type: m.type || 'photo', url: m.url || m.src })),
      };
      const { data: post, error } = await supabase.from('blog_posts').update(row).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ post });
    }

    if (req.method === 'DELETE') {
      const user = await resolveUserId({ body: {}, headers: req.headers, query });
      if (!user) return res.status(401).json({ error: 'Необходима авторизация' });
      if (!(await isAdmin(supabase, user.id))) return res.status(403).json({ error: 'Только админ может удалять посты' });
      const id = query.id || query.postId;
      if (!id) return res.status(400).json({ error: 'Укажите id поста' });
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('blog error:', err);
    return res.status(500).json({ error: err.message });
  }
};
