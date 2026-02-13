const BOT_TOKEN = process.env.BOT_TOKEN;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const path = req.query.path;
  if (!path || !BOT_TOKEN) return res.status(404).end();

  try {
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).end();
    const buf = await r.arrayBuffer();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.send(Buffer.from(buf));
  } catch {
    res.status(404).end();
  }
};
