// MildMate Abandoned Cart Recovery Cron
// Runs once daily via Cloudflare Pages cron trigger
// Single-stage: sends one gentle reminder email 24h after cart abandoned

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

// ── Email Template ──

function buildRecoveryEmail(items: CartItem[]): string {
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

// ── Main Scheduled Handler ──

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.error('CRON: RESEND_API_KEY not set — skipping recovery');
    return;
  }

  const MAX_PER_DAY = 50;

  const todayCount = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM abandoned_carts
     WHERE recovery_sent_at >= datetime('now', 'start of day')
       AND recovery_sent_at IS NOT NULL`
  ).first();
  const sentToday = (todayCount && (todayCount as any).cnt) ? Number((todayCount as any).cnt) : 0;

  if (sentToday >= MAX_PER_DAY) {
    console.log(`CRON: daily recovery limit reached (${sentToday}/${MAX_PER_DAY}) — skipping`);
    return;
  }

  const limit = Math.min(MAX_PER_DAY - sentToday, 5);
  const { results: carts } = await env.DB.prepare(
    `SELECT id, email, cart_json FROM abandoned_carts
     WHERE recovered = 0 AND recovery_stage = 0
       AND created_at < datetime('now', '-24 hours')
     LIMIT ${limit}`
  ).all();

  if (!carts || carts.length === 0) {
    console.log('CRON: no eligible abandoned carts');
    return;
  }

  console.log(`CRON: ${carts.length} cart(s) found for recovery`);

  let sent = 0, failed = 0;

  for (const cart of carts as any[]) {
    let cartItems: CartItem[] = [];
    try {
      cartItems = JSON.parse(cart.cart_json || '[]');
    } catch {
      console.log(`CRON: invalid cart_json for ${cart.email}, skipping`);
      continue;
    }
    if (!cartItems.length) continue;

    const html = buildRecoveryEmail(cartItems);
    const ok = await sendRecoveryEmail(env, cart.email, 'You left something behind \u2014 your MildMate cart', html);

    if (ok) {
      await env.DB.prepare("UPDATE abandoned_carts SET recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
      sent++;
      console.log(`CRON: recovery sent to ${cart.email}`);
    } else {
      failed++;
    }
  }

  console.log(`CRON: done — ${sent} sent, ${failed} failed (quota: ${sentToday + sent}/${MAX_PER_DAY} today)`);
}
