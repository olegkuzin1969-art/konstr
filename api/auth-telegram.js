const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function createSessionToken(userId) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: userId, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const sign = crypto.createHmac('sha256', BOT_TOKEN).update(`${b64(header)}.${b64(payload)}`).digest('base64url');
  return `${b64(header)}.${b64(payload)}.${sign}`;
}

function verifySessionToken(token) {
  if (!token) return null;
  try {
    const [headerB64, payloadB64, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', BOT_TOKEN).update(`${headerB64}.${payloadB64}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function verifyWidgetHash(data) {
  const hash = data.hash;
  if (!hash) return false;
  const checkPairs = [];
  for (const k of Object.keys(data)) {
    if (k !== 'hash') checkPairs.push([k, data[k]]);
  }
  checkPairs.sort((a, b) => a[0].localeCompare(b[0]));
  const dataCheckString = checkPairs.map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return calculated === hash;
}

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server config error' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { type, initData, widgetData } = body;

    let user = null;

    if (type === 'tma' && initData) {
      if (!verifyInitData(initData)) return res.status(401).json({ error: 'Invalid initData' });
      user = parseUserFromInitData(initData);
      if (!user) return res.status(400).json({ error: 'No user in initData' });
    } else if (type === 'widget' && widgetData) {
      if (!verifyWidgetHash(widgetData)) return res.status(401).json({ error: 'Invalid widget hash' });
      user = {
        id: widgetData.id,
        first_name: widgetData.first_name,
        last_name: widgetData.last_name || '',
        username: widgetData.username || '',
        photo_url: widgetData.photo_url || '',
      };
    } else if (type === 'code' && body.code) {
      const code = String(body.code).trim().toUpperCase();
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data: row, error: fetchErr } = await supabase
        .from('login_codes')
        .select('*')
        .eq('code', code)
        .single();
      if (fetchErr || !row) return res.status(401).json({ error: 'Неверный или устаревший код' });
      const age = (Date.now() - new Date(row.created_at).getTime()) / 60000;
      if (age > 5) {
        await supabase.from('login_codes').delete().eq('code', code);
        return res.status(401).json({ error: 'Код истёк' });
      }
      user = {
        id: row.telegram_id,
        first_name: row.first_name,
        last_name: row.last_name || '',
        username: row.username || '',
        photo_url: row.photo_url || '',
      };
      await supabase.from('login_codes').delete().eq('code', code);
    } else {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const telegramId = user.id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const row = {
      telegram_id: telegramId,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      username: user.username || null,
      photo_url: user.photo_url || null,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from('users')
      .upsert(row, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
    let photoUrl = result.photo_url;
    if (photoUrl && !photoUrl.startsWith('http') && baseUrl) {
      photoUrl = `${baseUrl}/api/avatar?path=${encodeURIComponent(photoUrl)}`;
    }

    const response = {
      user: {
        id: result.id,
        telegram_id: result.telegram_id,
        first_name: result.first_name,
        last_name: result.last_name,
        username: result.username,
        photo_url: photoUrl || result.photo_url,
      },
    };
    if (body.type === 'code') {
      response.token = createSessionToken(result.id);
    }
    return res.status(200).json(response);
  } catch (err) {
    console.error('auth-telegram error:', err);
    return res.status(500).json({ error: err.message });
  }
};
