const PDFDocument = require('pdfkit');
const { Resend } = require('resend');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM =
  process.env.RESEND_FROM ||
  'Конструкт <onboarding@resend.dev>';

// Пути к шрифтам с поддержкой кириллицы.
// Вам нужно самостоятельно положить сюда файлы TTF и задеплоить проект.
// Например:
// - fonts/DejaVuSans.ttf
// - fonts/DejaVuSans-Bold.ttf
const FONT_REGULAR_PATH = path.join(
  __dirname,
  '..',
  'fonts',
  'DejaVuSans.ttf'
);
const FONT_BOLD_PATH = path.join(
  __dirname,
  '..',
  'fonts',
  'DejaVuSans-Bold.ttf'
);

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function extractTemplateText(row, lang) {
  const useEn = lang === 'en';
  const header =
    (useEn ? row.header_en : row.header_ru) ||
    row.header_ru ||
    row.header_en ||
    '';
  const title =
    (useEn ? row.title_en : row.title_ru) ||
    row.title_ru ||
    row.title_en ||
    '';
  const body =
    (useEn ? row.body_en : row.body_ru) ||
    row.body_ru ||
    row.body_en ||
    '';
  return { header, title, body };
}

function buildVarsMap(header, title, body, orderData) {
  const text = [header, title, body].join('\n');
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) keys.add(m[1]);
  }

  const vars = {};
  const data = orderData || {};
  const fields = data.fields || {};

  keys.forEach((key) => {
    let raw = '';
    if (fields[key] != null) {
      raw = fields[key];
    } else if (data[key] != null) {
      raw = data[key];
    }
    let s = String(raw ?? '').trim();
    if (!s && key !== 'extraInfo') {
      s = '___________';
    }
    vars[key] = s;
  });

  return vars;
}

function fillPlaceholders(source, vars) {
  return String(source || '').replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_, k) => (vars[k] !== undefined ? String(vars[k]) : '')
  );
}

async function prepareOrderDocument({ supabase, orderData, lang }) {
  const useLang = lang === 'en' ? 'en' : 'ru';
  const tplId =
    (orderData && (orderData.templateId || orderData.template_id)) || null;

  let tplRow = null;

  if (tplId) {
    const { data, error } = await supabase
      .from('templates')
      .select(
        'id, name, header_ru, header_en, title_ru, title_en, body_ru, body_en'
      )
      .eq('id', tplId)
      .single();
    if (!error && data) {
      tplRow = data;
    }
  }

  if (!tplRow) {
    const { data, error } = await supabase
      .from('templates')
      .select(
        'id, name, header_ru, header_en, title_ru, title_en, body_ru, body_en'
      )
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!error && data) {
      tplRow = data;
    }
  }

  if (!tplRow) {
    const headerText = '';
    const titleText = 'Документ';
    const bodyText =
      (orderData && orderData.rawText) ||
      (orderData && orderData.preview) ||
      '';
    return {
      headerText,
      titleText,
      bodyText,
      templateName: 'Документ',
    };
  }

  if (orderData && orderData.fullTextOverride && String(orderData.fullTextOverride).trim()) {
    return {
      headerText: '',
      titleText: '',
      bodyText: String(orderData.fullTextOverride).trim(),
      templateName: tplRow.name || 'Документ',
    };
  }

  const { header, title, body } = extractTemplateText(tplRow, useLang);
  const vars = buildVarsMap(header, title, body, orderData);

  const headerText =
    header && header.trim()
      ? fillPlaceholders(header.trim(), vars)
      : '';
  const titleText = fillPlaceholders(title, vars);
  const bodyText = fillPlaceholders(body, vars);

  return {
    headerText,
    titleText,
    bodyText,
    templateName: tplRow.name || 'Документ',
  };
}

function buildOrderPdfBuffer({ headerText, titleText, bodyText, lang }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const isRu = lang !== 'en';

    // Пытаемся использовать встроенный шрифт с поддержкой кириллицы.
    // Если файлов нет, PDFKit упадёт — поэтому оборачиваем в try/catch
    // и откатываемся на стандартный Helvetica (как раньше).
    let regularFont = 'Helvetica';
    let boldFont = 'Helvetica-Bold';
    try {
      doc.font(FONT_REGULAR_PATH);
      regularFont = FONT_REGULAR_PATH;
      try {
        doc.font(FONT_BOLD_PATH);
        boldFont = FONT_BOLD_PATH;
      } catch {
        boldFont = regularFont;
      }
    } catch {
      doc.font(regularFont);
    }

    if (headerText) {
      doc
        .fontSize(10)
        .font(regularFont)
        .text(headerText, {
          align: 'left',
        })
        .moveDown(1.5);
    }

    if (titleText) {
      doc
        .fontSize(12)
        .font(boldFont)
        .text(titleText, {
          align: 'center',
        })
        .moveDown(1.5)
        .font(regularFont);
    }

    if (bodyText) {
      doc
        .fontSize(10)
        .font(regularFont)
        .text(bodyText, {
          align: 'left',
        });
    } else {
      doc
        .moveDown()
        .fontSize(10)
        .text(
          isRu
            ? 'Текст документа недоступен.'
            : 'Document text is not available.',
          { align: 'left' }
        );
    }

    doc.end();
  });
}

async function sendOrderEmail({
  to,
  lang,
  templateName,
  withExpert,
  amountBye,
  pdfBuffer,
  filename,
}) {
  if (!RESEND_API_KEY) {
    console.error(
      'sendOrderEmail: RESEND_API_KEY is not set, email will not be sent'
    );
    return;
  }
  if (!to) {
    console.error('sendOrderEmail: "to" email is empty, skip sending');
    return;
  }

  const resend = new Resend(RESEND_API_KEY);
  const isRu = lang !== 'en';

  const safeTemplateName =
    templateName || (isRu ? 'Документ из конструктора' : 'Constructor document');

  const subject = isRu
    ? `Ваш документ: ${safeTemplateName}`
    : `Your document: ${safeTemplateName}`;

  const tariffLabel =
    withExpert === true
      ? isRu
        ? 'Тариф: с экспертом'
        : 'Tariff: with expert review'
      : isRu
      ? 'Тариф: базовый'
      : 'Tariff: base';

  const amountText =
    typeof amountBye === 'number' && Number.isFinite(amountBye)
      ? `${amountBye} BYE`
      : '';

  const lines = [];
  if (isRu) {
    lines.push(
      `<p>Вы оформили документ по шаблону <strong>${escapeHtml(
        safeTemplateName
      )}</strong>.</p>`
    );
    if (amountText) {
      lines.push(`<p>${escapeHtml(tariffLabel)} — ${escapeHtml(amountText)}.</p>`);
    } else {
      lines.push(`<p>${escapeHtml(tariffLabel)}.</p>`);
    }
    lines.push(
      '<p>PDF‑версия документа прикреплена к этому письму. Вы можете распечатать её или сохранить.</p>'
    );
  } else {
    lines.push(
      `<p>You have created a document based on <strong>${escapeHtml(
        safeTemplateName
      )}</strong>.</p>`
    );
    if (amountText) {
      lines.push(`<p>${escapeHtml(tariffLabel)} — ${escapeHtml(amountText)}.</p>`);
    } else {
      lines.push(`<p>${escapeHtml(tariffLabel)}.</p>`);
    }
    lines.push(
      '<p>A PDF version of the document is attached to this email. You can print or save it.</p>'
    );
  }

  const html = lines.join('\n');

  const attachments = [];
  if (pdfBuffer && filename) {
    attachments.push({
      filename,
      content: pdfBuffer.toString('base64'),
      contentType: 'application/pdf',
    });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to: [to],
      subject,
      html,
      attachments: attachments.length ? attachments : undefined,
    });

    if (error) {
      console.error('sendOrderEmail: Resend returned error:', error);
      throw new Error(error.message || 'Resend email error');
    }

    console.log('sendOrderEmail: email sent via Resend', {
      to,
      id: data?.id,
    });
  } catch (err) {
    console.error('sendOrderEmail: exception while sending email:', err);
    throw err;
  }
}

module.exports = {
  prepareOrderDocument,
  buildOrderPdfBuffer,
  sendOrderEmail,
};

