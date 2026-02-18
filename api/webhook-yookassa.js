const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server config error' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const event = body.event || body.type;
    const payment = body.object;

    if (event !== 'payment.succeeded' || !payment?.id) {
      return res.status(200).json({ ok: true });
    }

    const paymentIntentId = payment.metadata?.payment_intent_id;
    if (!paymentIntentId) return res.status(200).json({ ok: true });

    // Проверяем статус оплаты через API ЮKassa — заказ создаём только при реальном succeeded
    if (YOOKASSA_SHOP_ID && YOOKASSA_SECRET_KEY) {
      const auth = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
      const yooRes = await fetch(`https://api.yookassa.ru/v3/payments/${payment.id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const verified = await yooRes.json().catch(() => ({}));
      if (verified.status !== 'succeeded') {
        return res.status(200).json({ ok: true });
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: intent, error: fetchError } = await supabase
      .from('payment_intents')
      .select('id, user_id, order_data, with_expert, status')
      .eq('id', paymentIntentId)
      .single();

    if (fetchError || !intent || intent.status !== 'pending') {
      return res.status(200).json({ ok: true });
    }

    const approved = intent.with_expert ? null : true;
    const { error: orderError } = await supabase.from('orders').insert({
      user_id: intent.user_id,
      data: intent.order_data,
      approved,
      revision_comment: '',
    });

    if (orderError) {
      console.error('webhook-yookassa order insert error:', orderError);
      return res.status(500).json({ error: orderError.message });
    }

    await supabase
      .from('payment_intents')
      .update({ status: 'completed' })
      .eq('id', intent.id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('webhook-yookassa error:', err);
    return res.status(500).json({ error: err.message });
  }
};
