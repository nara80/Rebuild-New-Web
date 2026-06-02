// MildMate Abandoned Cart Recovery Cron
// Runs once daily via Cloudflare Pages cron trigger
// Multi-stage recovery with basket-size threshold
// Stage 1 (24h): Gentle reminder — always sent
// Stage 2 (72h): Discount offer — only if cart total >= basket_threshold_usd
// Stage 3 (7d):  Last chance — same discount code, urgency

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
}

// ── Helpers ──

function escHtml(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPrice(thb?: number, usd?: number): string {
  const parts: string[] = [];
  if (thb) parts.push('\u0E3F' + Math.round(thb).toLocaleString());
  if (usd) parts.push('$' + Math.round(usd));
  return parts.join(' / ') || '\u2014';
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

// ── Email Templates ──

function buildStage1Email(items: CartItem[]): string {
  const rows = buildCartRows(items);
  const total = calcCartTotal(items);
  const checkoutUrl = 'https://mildmate-new.pages.dev/checkout/';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">You left something behind</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your MildMate cart is waiting for you</p>
</td></tr>
<tr><td style="padding:24px">
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">We noticed you added custom bedding to your cart but didn&rsquo;t complete your order. Your items are still saved and ready to go.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px">
<tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F172A;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">${items.length} item(s) — ${formatPrice(total.thb, total.usd)}</td></tr>
${rows}
</table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${checkoutUrl}" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Return to Your Cart</a>
</td></tr></table>
<p style="color:#64748b;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center">Items in your cart are reserved but availability may change.<br>Questions? Reply or contact <a href="mailto:contact@mildmate.com" style="color:#2c96f4">contact@mildmate.com</a></p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px;margin:0">MildMate &middot; Custom Bedding Made in Thailand<br><a href="https://www.mildmate.com" style="color:#2c96f4;text-decoration:none">www.mildmate.com</a> &middot; <a href="https://www.mildmate.com/policy/" style="color:#94a3b8;text-decoration:none">Privacy</a></p>
</td></tr></table></body></html>`;
}

function buildStage2Email(items: CartItem[], discountCode: string, discountPct: number): string {
  const rows = buildCartRows(items);
  const total = calcCartTotal(items);
  const discountUsd = Math.round(total.usd * discountPct / 100);
  const finalUsd = total.usd - discountUsd;
  const checkoutUrl = 'https://mildmate-new.pages.dev/checkout/?code=' + discountCode;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Still thinking?</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Here&rsquo;s ${discountPct}% off to help you decide</p>
</td></tr>
<tr><td style="padding:24px">
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Your MildMate cart is still waiting. We&rsquo;d love to help you get the perfect custom-fit bedding, so here&rsquo;s a special offer.</p>
<div style="background:#F0F9FF;border:2px dashed #2c96f4;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
<p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Your discount code</p>
<p style="margin:0;font-size:28px;font-weight:700;color:#2c96f4;letter-spacing:2px">${discountCode}</p>
<p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${discountPct}% off — save $${discountUsd}</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px">
<tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F172A;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">${items.length} item(s) — ${formatPrice(total.thb, total.usd)}</td></tr>
${rows}
<tr><td colspan="2" style="padding:14px 16px;text-align:right;font-weight:700;font-size:15px">With ${discountPct}% off: <span style="color:#2c96f4">${formatPrice(undefined, finalUsd)}</span></td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${checkoutUrl}" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Claim ${discountPct}% Off &amp; Return to Cart</a>
</td></tr></table>
<p style="color:#64748b;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center">Discount expires 60 days after this email. Questions? Reply or contact <a href="mailto:contact@mildmate.com" style="color:#2c96f4">contact@mildmate.com</a></p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px;margin:0">MildMate &middot; Custom Bedding Made in Thailand<br><a href="https://www.mildmate.com" style="color:#2c96f4;text-decoration:none">www.mildmate.com</a> &middot; <a href="https://www.mildmate.com/policy/" style="color:#94a3b8;text-decoration:none">Privacy</a></p>
</td></tr></table></body></html>`;
}

function buildStage3Email(items: CartItem[], discountCode: string, discountPct: number): string {
  const rows = buildCartRows(items);
  const total = calcCartTotal(items);
  const discountUsd = Math.round(total.usd * discountPct / 100);
  const finalUsd = total.usd - discountUsd;
  const checkoutUrl = 'https://mildmate-new.pages.dev/checkout/?code=' + discountCode;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
<tr><td style="background:linear-gradient(135deg,#FF6B35,#E85D2C);padding:32px 24px;text-align:center">
<h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Last chance</h1>
<p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your ${discountPct}% off discount expires soon</p>
</td></tr>
<tr><td style="padding:24px">
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Hi there,</p>
<p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Your MildMate cart is about to expire. If you still want custom-fit bedding made just for you, now is the time.</p>
<div style="background:#FFF8F5;border:2px dashed #FF6B35;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
<p style="margin:0 0 8px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Your discount code</p>
<p style="margin:0;font-size:28px;font-weight:700;color:#FF6B35;letter-spacing:2px">${discountCode}</p>
<p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${discountPct}% off — save $${discountUsd} &bull; expires in 3 days</p>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px">
<tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0F172A;font-size:13px;text-transform:uppercase;letter-spacing:0.05em">${items.length} item(s) — ${formatPrice(total.thb, total.usd)}</td></tr>
${rows}
<tr><td colspan="2" style="padding:14px 16px;text-align:right;font-weight:700;font-size:15px">With ${discountPct}% off: <span style="color:#FF6B35">${formatPrice(undefined, finalUsd)}</span></td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${checkoutUrl}" style="display:inline-block;background:#FF6B35;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Use Your ${discountPct}% Off Before It Expires</a>
</td></tr></table>
<p style="color:#64748b;font-size:13px;line-height:1.5;margin:24px 0 0;text-align:center">Questions? Reply or contact <a href="mailto:contact@mildmate.com" style="color:#2c96f4">contact@mildmate.com</a></p>
</td></tr>
<tr><td style="background:#F8FAFC;padding:20px 24px;text-align:center;border-top:1px solid #e2e8f0">
<p style="color:#94a3b8;font-size:12px;margin:0">MildMate &middot; Custom Bedding Made in Thailand<br><a href="https://www.mildmate.com" style="color:#FF6B35;text-decoration:none">www.mildmate.com</a> &middot; <a href="https://www.mildmate.com/policy/" style="color:#94a3b8;text-decoration:none">Privacy</a></p>
</td></tr></table></body></html>`;
}

// ── D1 Config Reader ──

async function loadRecoveryConfig(db: D1Database): Promise<RecoveryConfig> {
  const defaults: RecoveryConfig = {
    basketThresholdUsd: 150,
    stage2Enabled: true,
    stage2Discount: 10,
    stage3Enabled: true,
    stage3Discount: 10,
    discountExpiryDays: 60,
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
    };
  } catch (e: any) {
    console.log('CRON: recovery_config not found, using defaults —', e.message);
    return defaults;
  }
}

// ── Send Email ──

async function sendRecoveryEmail(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
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
      console.error(`CRON: Resend ${resp.status} for ${to}: ${errBody.substring(0, 200)}`);
    }
    return resp.ok;
  } catch (e: any) {
    console.error(`CRON: Resend error for ${to}: ${e.message}`);
    return false;
  }
}

// ── Process Single Stage ──

async function processStage(
  env: Env,
  config: RecoveryConfig,
  stage: number,
  cart: any
): Promise<boolean> {
  let cartItems: CartItem[] = [];
  try {
    cartItems = JSON.parse(cart.cart_json || '[]');
  } catch {
    console.log(`CRON: invalid cart_json for ${cart.email}, skipping`);
    return false;
  }
  if (!cartItems.length) return false;

  const total = calcCartTotal(cartItems);
  const isHighValue = total.usd >= config.basketThresholdUsd;

  if (stage === 1) {
    const html = buildStage1Email(cartItems);
    const ok = await sendRecoveryEmail(env, cart.email, 'You left something behind \u2014 your MildMate cart', html);
    if (!ok) return false;

    if (isHighValue) {
      await env.DB.prepare("UPDATE abandoned_carts SET recovery_stage = 1, recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
      console.log(`CRON: stage 1 sent to ${cart.email} ($${total.usd} >= $${config.basketThresholdUsd} — eligible for stage 2)`);
    } else {
      await env.DB.prepare("UPDATE abandoned_carts SET recovery_stage = 3, recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
      console.log(`CRON: stage 1 sent to ${cart.email} ($${total.usd} < $${config.basketThresholdUsd} — single stage only)`);
    }
    return true;
  }

  if (stage === 2 && config.stage2Enabled && isHighValue) {
    const discountCode = generateDiscountCode();
    const html = buildStage2Email(cartItems, discountCode, config.stage2Discount);

    try {
      const expiresAt = new Date(Date.now() + config.discountExpiryDays * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      await env.DB.prepare(
        "INSERT INTO discount_claims (code, email, status, discount_pct, expires_at, source, created_at) VALUES (?, ?, 'issued', ?, ?, 'abandoned_cart', datetime('now'))"
      ).bind(discountCode, cart.email, config.stage2Discount, expiresAt).run();
    } catch (e: any) {
      console.log(`CRON: discount claim for ${cart.email} skipped (${e.message})`);
    }

    const ok = await sendRecoveryEmail(env, cart.email, `Still thinking? Here's ${config.stage2Discount}% off \u2014 your MildMate cart`, html);
    if (!ok) return false;

    await env.DB.prepare(
      "UPDATE abandoned_carts SET recovery_stage = 2, recovery_sent_at = datetime('now'), discount_code = ? WHERE id = ?"
    ).bind(discountCode, cart.id).run();
    console.log(`CRON: stage 2 sent to ${cart.email} (${config.stage2Discount}% off, code ${discountCode})`);
    return true;
  }

  if (stage === 3 && config.stage3Enabled && isHighValue) {
    const discountCode = cart.discount_code || generateDiscountCode();
    const html = buildStage3Email(cartItems, discountCode, config.stage3Discount);
    const ok = await sendRecoveryEmail(env, cart.email, `Last chance \u2014 your ${config.stage3Discount}% off expires soon`, html);
    if (!ok) return false;

    await env.DB.prepare(
      "UPDATE abandoned_carts SET recovery_stage = 3, recovery_sent_at = datetime('now') WHERE id = ?"
    ).bind(cart.id).run();
    console.log(`CRON: stage 3 sent to ${cart.email} (final)`);
    return true;
  }

  return false;
}

// ── Main Scheduled Handler ──

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.error('CRON: RESEND_API_KEY not set — skipping');
    return;
  }

  const config = await loadRecoveryConfig(env.DB);
  console.log(`CRON: config loaded — threshold=$${config.basketThresholdUsd}, s2=${config.stage2Enabled}(${config.stage2Discount}%), s3=${config.stage3Enabled}(${config.stage3Discount}%)`);

  const MAX_PER_DAY = 50;
  const todayCount = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM abandoned_carts WHERE recovery_sent_at >= datetime('now', 'start of day') AND recovery_sent_at IS NOT NULL"
  ).first();
  const sentToday = (todayCount && (todayCount as any).cnt) ? Number((todayCount as any).cnt) : 0;
  if (sentToday >= MAX_PER_DAY) {
    console.log(`CRON: daily limit reached (${sentToday}/${MAX_PER_DAY}) — skipping`);
    return;
  }
  const remaining = MAX_PER_DAY - sentToday;

  // Stage 1
  const s1Limit = Math.min(remaining, 5);
  const { results: s1Carts } = await env.DB.prepare(
    `SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 0 AND created_at < datetime('now', '-24 hours') LIMIT ${s1Limit}`
  ).all();
  let sent = 0, failed = 0;

  if (s1Carts && s1Carts.length > 0) {
    console.log(`CRON: stage 1 — ${s1Carts.length} cart(s)`);
    for (const cart of s1Carts as any[]) {
      const ok = await processStage(env, config, 1, cart);
      if (ok) sent++; else failed++;
    }
  }

  // Stage 2
  if (sent < remaining && config.stage2Enabled) {
    const s2Limit = Math.min(remaining - sent, 3);
    const { results: s2Carts } = await env.DB.prepare(
      `SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 1 AND recovery_sent_at < datetime('now', '-48 hours') LIMIT ${s2Limit}`
    ).all();
    if (s2Carts && s2Carts.length > 0) {
      console.log(`CRON: stage 2 — ${s2Carts.length} cart(s)`);
      for (const cart of s2Carts as any[]) {
        const ok = await processStage(env, config, 2, cart);
        if (ok) sent++; else failed++;
      }
    }
  }

  // Stage 3
  if (sent < remaining && config.stage3Enabled) {
    const s3Limit = Math.min(remaining - sent, 3);
    const { results: s3Carts } = await env.DB.prepare(
      `SELECT id, email, cart_json, discount_code FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 2 AND recovery_sent_at < datetime('now', '-4 days') LIMIT ${s3Limit}`
    ).all();
    if (s3Carts && s3Carts.length > 0) {
      console.log(`CRON: stage 3 — ${s3Carts.length} cart(s)`);
      for (const cart of s3Carts as any[]) {
        const ok = await processStage(env, config, 3, cart);
        if (ok) sent++; else failed++;
      }
    }
  }

  console.log(`CRON: done — ${sent} sent, ${failed} failed (${sentToday + sent}/${MAX_PER_DAY} today)`);
}
