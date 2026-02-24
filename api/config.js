const { createClient } = require('@supabase/supabase-js');

// Публичный конфиг для фронта (Supabase anon key безопасен для клиента)
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

  // Короткий кеш: шаблоны должны обновляться быстро
  res.setHeader('Cache-Control', 'public, max-age=300');

  let templates = [];
  let variables = [];
  let pricing = null;
  let appearance = null;
  let texts = [];
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await supabase
        .from('templates')
        .select('id, name, description, header_ru, header_en, title_ru, title_en, body_ru, body_en, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      templates = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        sort_order: row.sort_order ?? 0,
        is_active: row.is_active !== false,
        content: {
          header: { ru: row.header_ru || '', en: row.header_en || '' },
          title: { ru: row.title_ru || '', en: row.title_en || '' },
          body: { ru: row.body_ru || '', en: row.body_en || '' },
        },
      }));

      const { data: varsData } = await supabase
        .from('template_variables')
        .select('id, key, label_ru, label_en, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      variables = (varsData || []).map((v) => ({
        id: v.id,
        key: v.key,
        label_ru: v.label_ru || '',
        label_en: v.label_en || '',
        sort_order: v.sort_order ?? 0,
      }));

      const { data: pricingRow } = await supabase
        .from('pricing')
        .select('id, base_price_rub, expert_price_rub, updated_at')
        .eq('id', 1)
        .single();
      if (pricingRow) {
        pricing = {
          base_price_rub: pricingRow.base_price_rub,
          expert_price_rub: pricingRow.expert_price_rub,
          updated_at: pricingRow.updated_at,
        };
      }

      const { data: appearanceRow } = await supabase
        .from('appearance')
        .select('id, bg_color, bg_elevated_color, bg_gradient_from, bg_gradient_to, accent_color, border_color, header_bg, footer_bg, card_bg, tabs_bg, preview_bg, primary_btn_bg, primary_btn_text, secondary_btn_bg, secondary_btn_text, updated_at')
        .eq('id', 1)
        .single();
      if (appearanceRow) {
        appearance = {
          bg_color: appearanceRow.bg_color,
          bg_elevated_color: appearanceRow.bg_elevated_color,
          bg_gradient_from: appearanceRow.bg_gradient_from,
          bg_gradient_to: appearanceRow.bg_gradient_to,
          accent_color: appearanceRow.accent_color,
          border_color: appearanceRow.border_color,
          header_bg: appearanceRow.header_bg,
          footer_bg: appearanceRow.footer_bg,
          card_bg: appearanceRow.card_bg,
          tabs_bg: appearanceRow.tabs_bg,
          preview_bg: appearanceRow.preview_bg,
          primary_btn_bg: appearanceRow.primary_btn_bg,
          primary_btn_text: appearanceRow.primary_btn_text,
          secondary_btn_bg: appearanceRow.secondary_btn_bg,
          secondary_btn_text: appearanceRow.secondary_btn_text,
          updated_at: appearanceRow.updated_at,
        };
      }

      const { data: textsRows } = await supabase
        .from('texts')
        .select('key, lang, value')
        .order('key', { ascending: true })
        .order('lang', { ascending: true });
      texts = textsRows || [];
    } catch {
      templates = [];
      variables = [];
      pricing = null;
      appearance = null;
      texts = [];
    }
  }

  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    templates,
    variables,
    pricing,
    appearance,
    texts,
  });
};
