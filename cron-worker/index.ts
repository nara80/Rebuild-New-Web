// MildMate Abandoned Cart Recovery Cron Worker
// Standalone Worker — runs hourly via cron trigger, gated on cron_hour_utc from D1

interface Env {
  DB: D1Database;
  RESEND_API_KEY: string;
  ORDER_FROM_EMAIL?: string;
}

interface CartItem {
  product_name?: string;
  product_slug?: string;
  fabric?: string;
  color?: string;
  dimensions?: { w: number; l: number; d?: number; unit: string };
  price_usd?: number;
  price_thb?: number;
  qty?: number;
}

interface RecoveryConfig {
  basketThresholdUsd: number;
  stage2Enabled: boolean;
  stage2Discount: number;
  stage3Enabled: boolean;
  stage3Discount: number;
  discountExpiryDays: number;
  cronHourUtc: number;
  quoteFollowupEnabled: boolean;
  quoteFollowupAgeHours: number;
  quoteFollowupExpiryWindowDays: number;
  quoteFollowupDailyCap: number;
  quoteFollowupEmailCooldownHours: number;
}

function escHtml(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPrice(thb?: number, usd?: number): string {
  const parts: string[] = [];
  if (thb) parts.push('\u0E3F' + Math.round(thb).toLocaleString());
  if (usd) parts.push('$' + Math.round(usd));
  return parts.join(' / ') || '\u2014';
}

function formatQuotePrice(quotedUsd?: number, quotedThb?: number): string {
  const usd = Number(quotedUsd || 0);
  const thb = Number(quotedThb || 0);
  if (usd > 0 && thb > 0) return `$${Math.round(usd)} / ฿${Math.round(thb).toLocaleString()}`;
  if (usd > 0) return `$${Math.round(usd)}`;
  if (thb > 0) return `฿${Math.round(thb).toLocaleString()}`;
  return '—';
}

function calcCartTotal(cartItems: CartItem[]): { usd: number; thb: number } {
  let usd = 0, thb = 0;
  for (const item of cartItems) {
    usd += (item.price_usd || 0) * (item.qty || 1);
    thb += (item.price_thb || 0) * (item.qty || 1);
  }
  return { usd, thb };
}

function generateDiscountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'RECOVER-' + code;
}

function buildCartRows(items: CartItem[]): string {
  let rows = '';
  items.forEach((item) => {
    const dims = item.dimensions
      ? [item.dimensions.w, item.dimensions.l, item.dimensions.d].filter(Boolean).join('\u00D7') + ' ' + (item.dimensions.unit || 'cm')
      : '';
    const specs = [item.fabric, item.color, dims].filter(Boolean).join(' \u00B7 ');
    rows += `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0">
        <div style="font-weight:700;color:#0F172A;font-size:15px">${escHtml(item.product_name || 'Custom Order')}</div>
        ${specs ? `<div style="font-size:13px;color:#64748b;margin-top:2px">${escHtml(specs)}</div>` : ''}
        <div style="font-size:13px;color:#64748b;margin-top:2px">Qty: ${item.qty || 1}</div>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0F172A;font-size:15px;white-space:nowrap">${formatPrice(item.price_thb, item.price_usd)}</td>
    </tr>`;
  });
  return rows;
}

function buildStage1Email(items: CartItem[]): string {
  const rows = buildCartRows(items);
  const total = calcCartTotal(items);
  const checkoutUrl = 'https://www.mildmate.com/checkout/';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">You left something behind</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your MildMate cart is waiting for you</p>
</td></tr>
<tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">We noticed you added custom bedding to your cart but didn&rsquo;t complete your order. Your items are still saved and ready to go.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px">
<tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F172A;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">${items.length} item(s) — ${formatPrice(total.thb, total.usd)}</td></tr>
${rows}</table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${checkoutUrl}" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Return to Your Cart</a>
</td></tr></table></td></tr></table></body></html>`;
}

function buildStage2Email(items: CartItem[], discountCode: string, discountPct: number): string {
  const rows = buildCartRows(items);
  const total = calcCartTotal(items);
  const discountUsd = Math.round(total.usd * discountPct / 100);
  const finalUsd = total.usd - discountUsd;
  const checkoutUrl = 'https://www.mildmate.com/checkout/?code=' + discountCode;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Still thinking?</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Here&rsquo;s ${discountPct}% off</p>
</td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Your MildMate cart is still waiting. Here&rsquo;s a special offer.</p>
<div style="background:#F0F9FF;border:2px dashed #2c96f4;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
<p style="margin:0 0 8px;font-size:13px;color:#64748b">Your discount code</p>
<p style="margin:0;font-size:28px;font-weight:700;color:#2c96f4;letter-spacing:2px">${discountCode}</p>
<p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${discountPct}% off — save $${discountUsd}</p></div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px">
<tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F172A;font-size:13px">${items.length} item(s) — ${formatPrice(total.thb, total.usd)}</td></tr>
${rows}<tr><td colspan="2" style="padding:14px 16px;text-align:right;font-weight:700;font-size:15px">With ${discountPct}% off: <span style="color:#2c96f4">${formatPrice(undefined, finalUsd)}</span></td></tr>
</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${checkoutUrl}" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Claim ${discountPct}% Off &amp; Return to Cart</a>
</td></tr></table></td></tr></table></body></html>`;
}

function buildStage3Email(items: CartItem[], discountCode: string, discountPct: number): string {
  const rows = buildCartRows(items);
  const total = calcCartTotal(items);
  const discountUsd = Math.round(total.usd * discountPct / 100);
  const finalUsd = total.usd - discountUsd;
  const checkoutUrl = 'https://www.mildmate.com/checkout/?code=' + discountCode;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#FF6B35,#E85D2C);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Last chance</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your ${discountPct}% off expires soon</p>
</td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Your MildMate cart is about to expire. If you still want custom-fit bedding, now is the time.</p>
<div style="background:#FFF8F5;border:2px dashed #FF6B35;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
<p style="margin:0 0 8px;font-size:13px;color:#64748b">Your discount code</p>
<p style="margin:0;font-size:28px;font-weight:700;color:#FF6B35;letter-spacing:2px">${discountCode}</p>
<p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${discountPct}% off — save $${discountUsd} &bull; expires in 3 days</p></div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px">
<tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F172A;font-size:13px">${items.length} item(s) — ${formatPrice(total.thb, total.usd)}</td></tr>
${rows}<tr><td colspan="2" style="padding:14px 16px;text-align:right;font-weight:700;font-size:15px">With ${discountPct}% off: <span style="color:#FF6B35">${formatPrice(undefined, finalUsd)}</span></td></tr>
</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${checkoutUrl}" style="display:inline-block;background:#FF6B35;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Use Your ${discountPct}% Off Before It Expires</a>
</td></tr></table></td></tr></table></body></html>`;
}

async function loadRecoveryConfig(db: D1Database): Promise<RecoveryConfig> {
  const defaults: RecoveryConfig = {
    basketThresholdUsd: 150,
    stage2Enabled: true,
    stage2Discount: 10,
    stage3Enabled: true,
    stage3Discount: 10,
    discountExpiryDays: 60,
    cronHourUtc: 10,
    quoteFollowupEnabled: false,
    quoteFollowupAgeHours: 72,
    quoteFollowupExpiryWindowDays: 7,
    quoteFollowupDailyCap: 20,
    quoteFollowupEmailCooldownHours: 24,
  };
  try {
    const { results } = await db.prepare('SELECT key, value FROM recovery_config').all();
    if (!results) return defaults;
    const map: Record<string, string> = {};
    for (const row of results as any[]) map[row.key] = row.value;
    return {
      basketThresholdUsd: map.basket_threshold_usd ? Number(map.basket_threshold_usd) : defaults.basketThresholdUsd,
      stage2Enabled: map.stage2_enabled !== 'false',
      stage2Discount: map.stage2_discount ? Number(map.stage2_discount) : defaults.stage2Discount,
      stage3Enabled: map.stage3_enabled !== 'false',
      stage3Discount: map.stage3_discount ? Number(map.stage3_discount) : defaults.stage3Discount,
      discountExpiryDays: map.discount_expiry_days ? Number(map.discount_expiry_days) : defaults.discountExpiryDays,
      cronHourUtc: map.cron_hour_utc ? Number(map.cron_hour_utc) : defaults.cronHourUtc,
      quoteFollowupEnabled: map.quote_followup_enabled === 'true',
      quoteFollowupAgeHours: map.quote_followup_age_hours ? Number(map.quote_followup_age_hours) : defaults.quoteFollowupAgeHours,
      quoteFollowupExpiryWindowDays: map.quote_followup_expiry_window_days ? Number(map.quote_followup_expiry_window_days) : defaults.quoteFollowupExpiryWindowDays,
      quoteFollowupDailyCap: map.quote_followup_daily_cap ? Number(map.quote_followup_daily_cap) : defaults.quoteFollowupDailyCap,
      quoteFollowupEmailCooldownHours: map.quote_followup_email_cooldown_hours ? Number(map.quote_followup_email_cooldown_hours) : defaults.quoteFollowupEmailCooldownHours,
    };
  } catch (e: any) {
    console.log('CRON: recovery_config not found, using defaults —', e.message);
    return defaults;
  }
}

async function sendRecoveryEmail(env: Env, to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.ORDER_FROM_EMAIL || 'MildMate <orders@mildmate.com>',
        to: [to],
        subject: subject,
        html: html,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`CRON-WORKER: Resend ${resp.status} for ${to}: ${errBody.substring(0, 200)}`);
    }
    return resp.ok;
  } catch (e: any) {
    console.error(`CRON-WORKER: Resend error for ${to}: ${e.message}`);
    return false;
  }
}

async function processStage(env: Env, config: RecoveryConfig, stage: number, cart: any): Promise<boolean> {
  let cartItems: CartItem[] = [];
  try { cartItems = JSON.parse(cart.cart_json || '[]'); } catch { return false; }
  if (!cartItems.length) return false;

  const total = calcCartTotal(cartItems);
  const isHighValue = total.usd >= config.basketThresholdUsd;

  if (stage === 1) {
    const html = buildStage1Email(cartItems);
    const ok = await sendRecoveryEmail(env, cart.email, 'You left something behind — your MildMate cart', html);
    if (!ok) return false;
    if (isHighValue) {
      await env.DB.prepare("UPDATE abandoned_carts SET recovery_stage = 1, recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
    } else {
      await env.DB.prepare("UPDATE abandoned_carts SET recovery_stage = 3, recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
    }
    console.log(`CRON-WORKER: stage 1 sent to ${cart.email} ($${total.usd})`);
    return true;
  }

  if (stage === 2 && config.stage2Enabled && isHighValue) {
    const discountCode = generateDiscountCode();
    const html = buildStage2Email(cartItems, discountCode, config.stage2Discount);
    try {
      const expiresAt = new Date(Date.now() + config.discountExpiryDays * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      await env.DB.prepare("INSERT INTO discount_claims (code, email, status, discount_pct, expires_at, source, created_at) VALUES (?, ?, 'issued', ?, ?, 'abandoned_cart', datetime('now'))").bind(discountCode, cart.email, config.stage2Discount, expiresAt).run();
    } catch (e: any) {}
    const ok = await sendRecoveryEmail(env, cart.email, `Still thinking? Here's ${config.stage2Discount}% off — your MildMate cart`, html);
    if (!ok) return false;
    await env.DB.prepare("UPDATE abandoned_carts SET recovery_stage = 2, recovery_sent_at = datetime('now'), discount_code = ? WHERE id = ?").bind(discountCode, cart.id).run();
    console.log(`CRON-WORKER: stage 2 sent to ${cart.email} (${config.stage2Discount}%)`);
    return true;
  }

  if (stage === 3 && config.stage3Enabled && isHighValue) {
    const discountCode = cart.discount_code || generateDiscountCode();
    const html = buildStage3Email(cartItems, discountCode, config.stage3Discount);
    const ok = await sendRecoveryEmail(env, cart.email, `Last chance — your ${config.stage3Discount}% off expires soon`, html);
    if (!ok) return false;
    await env.DB.prepare("UPDATE abandoned_carts SET recovery_stage = 3, recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
    console.log(`CRON-WORKER: stage 3 sent to ${cart.email} (final)`);
    return true;
  }
  return false;
}

type QuoteFollowupRow = {
  quote_id: string;
  email: string;
  customer_name?: string;
  product_slug?: string;
  quoted_price_usd?: number | null;
  quoted_price?: number | null;
  expires_at?: string | null;
};

async function ensureQuoteFollowupSchema(env: Env): Promise<void> {
  // Self-heal in case migration 059 has not been applied yet (webhook also heals this).
  try {
    const orderInfo = await env.DB.prepare("PRAGMA table_info(orders)").all();
    const orderCols = new Set(((orderInfo.results || []) as any[]).map((r: any) => String(r.name || '').toLowerCase()));
    if (!orderCols.has('quote_id')) {
      await env.DB.prepare("ALTER TABLE orders ADD COLUMN quote_id TEXT").run();
    }
  } catch (e: any) {
    console.error('CRON-WORKER: orders.quote_id self-heal failed —', e?.message || e);
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS quote_followup_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       quote_id TEXT NOT NULL,
       email TEXT NOT NULL,
       stage TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'sent',
       error TEXT,
       sent_at DATETIME,
       run_source TEXT DEFAULT 'cron-worker',
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
     )`
  ).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_followup_unique_stage ON quote_followup_events(quote_id, stage)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quote_followup_status_sent ON quote_followup_events(status, sent_at)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quote_followup_email_created ON quote_followup_events(email, created_at)").run();
}

function buildQuoteFollowupEmail(q: QuoteFollowupRow): { subject: string; html: string } {
  const quoteId = String(q.quote_id || '').trim();
  const quoteLink = 'https://www.mildmate.com/quote/' + encodeURIComponent(quoteId) + '/';
  const subject = `Your MildMate Quote ${quoteId} expires soon`;
  const priceText = formatQuotePrice(Number(q.quoted_price_usd || 0), Number(q.quoted_price || 0));
  const expiresText = q.expires_at ? String(q.expires_at).slice(0, 16).replace('T', ' ') : 'soon';
  const name = String(q.customer_name || '').trim();
  const hello = name ? `Hi ${escHtml(name)},` : 'Hi there,';
  const product = escHtml(String(q.product_slug || 'custom item'));

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Your quote is ready to order</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Quote ${escHtml(quoteId)} expires ${escHtml(expiresText)}</p>
</td></tr>
<tr><td style="padding:24px">
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">${hello}</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 18px">Your approved custom quote is still active. If you would like to proceed, use your quote link below before expiry.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:22px">
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Quote</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0F172A">${escHtml(quoteId)}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Product</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0F172A">${product}</td></tr>
<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Price</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0F172A">${escHtml(priceText)}</td></tr>
<tr><td style="padding:12px 16px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Expires</td><td style="padding:12px 16px;text-align:right;color:#0F172A">${escHtml(expiresText)}</td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${quoteLink}" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">View Quote &amp; Order</a>
</td></tr></table>
<p style="color:#64748b;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center">Questions? Reply to this email or contact <a href="mailto:contact@mildmate.com" style="color:#2c96f4">contact@mildmate.com</a></p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px;margin:0">MildMate &middot; Custom Bedding Made in Thailand<br><a href="https://www.mildmate.com" style="color:#2c96f4;text-decoration:none">www.mildmate.com</a></p>
</td></tr></table></body></html>`;

  return { subject, html };
}

async function processQuoteFollowups(env: Env, config: RecoveryConfig): Promise<void> {
  if (!config.quoteFollowupEnabled) {
    console.log('CRON-WORKER: quote follow-up disabled');
    return;
  }

  await ensureQuoteFollowupSchema(env);
  const stage = 'pre_expiry_1';
  const cap = Math.max(1, Math.min(200, Number(config.quoteFollowupDailyCap || 20)));
  const ageHours = Math.max(1, Math.min(720, Number(config.quoteFollowupAgeHours || 72)));
  const windowDays = Math.max(1, Math.min(30, Number(config.quoteFollowupExpiryWindowDays || 7)));
  const cooldownHours = Math.max(1, Math.min(720, Number(config.quoteFollowupEmailCooldownHours || 24)));

  const due = await env.DB.prepare(
    `SELECT
       q.quote_id, q.email, q.customer_name, q.product_slug, q.quoted_price_usd, q.quoted_price, q.expires_at, q.created_at
     FROM custom_quotes q
     WHERE LOWER(COALESCE(q.status, 'pending')) = 'approved'
       AND COALESCE(TRIM(q.email), '') != ''
       AND q.expires_at IS NOT NULL
       AND q.expires_at > datetime('now')
       AND q.expires_at <= datetime('now', '+' || ?1 || ' days')
       AND q.created_at <= datetime('now', '-' || ?2 || ' hours')
       AND NOT EXISTS (
         SELECT 1 FROM orders o
         WHERE o.quote_id = q.quote_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM quote_followup_events e
         WHERE e.quote_id = q.quote_id
           AND e.stage = ?3
           AND e.status = 'sent'
       )
     ORDER BY q.expires_at ASC, q.created_at ASC
     LIMIT ?4`
  ).bind(windowDays, ageHours, stage, cap * 4).all();

  const rows = (due.results || []) as any[];
  if (!rows.length) {
    console.log('CRON-WORKER: quote follow-up none eligible');
    return;
  }

  let sent = 0;
  let failed = 0;
  const batchEmails = new Set<string>();

  for (const raw of rows) {
    if (sent >= cap) break;

    const q: QuoteFollowupRow = {
      quote_id: String(raw.quote_id || ''),
      email: String(raw.email || '').trim().toLowerCase(),
      customer_name: String(raw.customer_name || ''),
      product_slug: String(raw.product_slug || ''),
      quoted_price_usd: raw.quoted_price_usd == null ? null : Number(raw.quoted_price_usd),
      quoted_price: raw.quoted_price == null ? null : Number(raw.quoted_price),
      expires_at: raw.expires_at || null,
    };
    if (!q.quote_id || !q.email) continue;

    if (batchEmails.has(q.email)) continue;
    const recent = await env.DB.prepare(
      `SELECT id FROM quote_followup_events
       WHERE LOWER(email) = ?1
         AND status = 'sent'
         AND sent_at >= datetime('now', '-' || ?2 || ' hours')
       LIMIT 1`
    ).bind(q.email, cooldownHours).first();
    if (recent) continue;

    const claim = await env.DB.prepare(
      `INSERT OR IGNORE INTO quote_followup_events
        (quote_id, email, stage, status, sent_at, run_source, created_at)
       VALUES (?1, ?2, ?3, 'pending', datetime('now'), 'cron-worker', datetime('now'))`
    ).bind(q.quote_id, q.email, stage).run() as any;
    const claimed = Number(claim?.meta?.changes || 0) > 0;
    if (!claimed) continue;

    const mail = buildQuoteFollowupEmail(q);
    const ok = await sendRecoveryEmail(env, q.email, mail.subject, mail.html);
    if (ok) {
      await env.DB.prepare(
        "UPDATE quote_followup_events SET status = 'sent', error = NULL, sent_at = datetime('now') WHERE quote_id = ?1 AND stage = ?2"
      ).bind(q.quote_id, stage).run();
      batchEmails.add(q.email);
      sent++;
      console.log(`CRON-WORKER: quote follow-up sent ${q.quote_id} -> ${q.email}`);
    } else {
      await env.DB.prepare(
        "UPDATE quote_followup_events SET status = 'failed', error = ?3, sent_at = datetime('now') WHERE quote_id = ?1 AND stage = ?2"
      ).bind(q.quote_id, stage, 'resend_failed').run();
      failed++;
      console.log(`CRON-WORKER: quote follow-up failed ${q.quote_id} -> ${q.email}`);
    }
  }

  console.log(`CRON-WORKER: quote follow-up done sent=${sent} failed=${failed} cap=${cap}`);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const config = await loadRecoveryConfig(env.DB);
    const nowUtcHour = new Date().getUTCHours();
    if (nowUtcHour !== config.cronHourUtc) {
      console.log(`CRON-WORKER: skipping — UTC ${nowUtcHour} != ${config.cronHourUtc}`);
      return;
    }
    if (!env.RESEND_API_KEY) { console.error('CRON-WORKER: no RESEND_API_KEY'); return; }

    const MAX = 50;
    const tc = await env.DB.prepare("SELECT COUNT(*) as cnt FROM abandoned_carts WHERE recovery_sent_at >= datetime('now', 'start of day') AND recovery_sent_at IS NOT NULL").first();
    const sentToday = (tc && (tc as any).cnt) ? Number((tc as any).cnt) : 0;
    if (sentToday >= MAX) { console.log(`CRON-WORKER: limit ${sentToday}/${MAX}`); return; }
    const rem = MAX - sentToday;

    let sent = 0, failed = 0;

    const { results: s1 } = await env.DB.prepare(`SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 0 AND created_at < datetime('now', '-24 hours') LIMIT ${Math.min(rem, 5)}`).all();
    if (s1 && s1.length > 0) {
      for (const c of s1 as any[]) { const ok = await processStage(env, config, 1, c); if (ok) sent++; else failed++; }
    }

    if (sent < rem && config.stage2Enabled) {
      const { results: s2 } = await env.DB.prepare(`SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 1 AND recovery_sent_at < datetime('now', '-48 hours') LIMIT ${Math.min(rem - sent, 3)}`).all();
      if (s2 && s2.length > 0) { for (const c of s2 as any[]) { const ok = await processStage(env, config, 2, c); if (ok) sent++; else failed++; } }
    }

    if (sent < rem && config.stage3Enabled) {
      const { results: s3 } = await env.DB.prepare(`SELECT id, email, cart_json, discount_code FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 2 AND recovery_sent_at < datetime('now', '-4 days') LIMIT ${Math.min(rem - sent, 3)}`).all();
      if (s3 && s3.length > 0) { for (const c of s3 as any[]) { const ok = await processStage(env, config, 3, c); if (ok) sent++; else failed++; } }
    }

    console.log(`CRON-WORKER: done — ${sent}/${failed} (${sentToday + sent}/${MAX})`);

    // ── Thank-you discount emails ──
    const { results: tyQueue } = await env.DB.prepare(
      "SELECT id, order_id, email, discount_code, discount_pct FROM thankyou_queue WHERE sent = 0 AND send_after <= datetime('now') LIMIT 10"
    ).all();

    if (tyQueue && tyQueue.length > 0) {
      console.log(`CRON-WORKER: thankyou queue — ${tyQueue.length} pending`);
      for (const t of tyQueue as any[]) {
        try {
          const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Thank you for your order</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Here&rsquo;s ${t.discount_pct}% off your next purchase</p>
</td></tr>
<tr><td style="padding:24px">
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Thank you for choosing MildMate. We hope you love your custom bedding. As a token of appreciation, here&rsquo;s a discount on your next order.</p>
<div style="background:#F0F9FF;border:2px dashed #2c96f4;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
<p style="margin:0 0 8px;font-size:13px;color:#64748b">Your discount code</p>
<p style="margin:0;font-size:28px;font-weight:700;color:#2c96f4;letter-spacing:2px">${t.discount_code}</p>
<p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${t.discount_pct}% off — valid for 1 year</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="https://www.mildmate.com/" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Shop MildMate</a>
</td></tr></table>
<p style="color:#64748b;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center">Discount applies to your entire order. Not combinable with other offers.<br>Questions? Reply or contact <a href="mailto:contact@mildmate.com" style="color:#2c96f4">contact@mildmate.com</a></p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px;margin:0">MildMate &middot; Custom Bedding Made in Thailand<br><a href="https://www.mildmate.com" style="color:#2c96f4;text-decoration:none">www.mildmate.com</a></p>
</td></tr></table></body></html>`;

          const ok = await sendRecoveryEmail(env, t.email, `Thank you — here's ${t.discount_pct}% off your next MildMate order`, html);
          if (ok) {
            await env.DB.prepare('UPDATE thankyou_queue SET sent = 1 WHERE id = ?').bind(t.id).run();
            console.log(`CRON-WORKER: thankyou sent to ${t.email} (${t.discount_code})`);
          } else {
            console.log(`CRON-WORKER: thankyou failed for ${t.email}`);
          }
        } catch (e: any) {
          console.log(`CRON-WORKER: thankyou error for ${t.email}: ${e.message}`);
        }
      }
    }

    await processQuoteFollowups(env, config);
  }
};
