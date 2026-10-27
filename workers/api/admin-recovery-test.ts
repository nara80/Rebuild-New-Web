// Admin Recovery Test — manually triggers abandoned cart recovery email
// POST /api/admin/recovery-test?stage=1|2|3&email=test@example.com
// Sends the real stage template to matching carts without mutating recovery state.
// Stage 2/3 use a TEST- code that is NOT inserted into discount_claims (not redeemable).

import { sendEmail } from "./email";
import { authorizeAdminBrowser } from "./admin-auth";

async function sendRecoveryEmail(env: any, to: string, subject: string, html: string): Promise<boolean> {
  const text = `You left something behind — your MildMate cart is waiting.\nReturn to your cart: https://www.mildmate.com/checkout/`;
  const result = await sendEmail(env, {
    to,
    from: env.ORDER_FROM_EMAIL || 'MildMate <orders@mildmate.com>',
    subject,
    text,
    html,
  });
  return result.success;
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

function generateTestCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'TEST-' + code;
}

function buildRows(items: any[]): string {
  let rows = '';
  items.forEach((item: any) => {
    const dims = item.dimensions ? [item.dimensions.w, item.dimensions.l, item.dimensions.d].filter(Boolean).join('\u00D7') + ' ' + (item.dimensions.unit || 'cm') : '';
    const specs = [item.fabric, item.color, dims].filter(Boolean).join(' \u00B7 ');
    rows += `<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0"><div style="font-weight:700;color:#0F172A;font-size:15px">${escHtml(item.product_name || 'Custom Order')}</div>${specs ? `<div style="font-size:13px;color:#64748b;margin-top:2px">${escHtml(specs)}</div>` : ''}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:15px">${formatPrice(item.price_thb, item.price_usd)}</td></tr>`;
  });
  return rows;
}

function cartTotals(items: any[]): { usd: number; thb: number } {
  let usd = 0, thb = 0;
  for (const item of items) {
    usd += (item.price_usd || 0) * (item.qty || 1);
    thb += (item.price_thb || 0) * (item.qty || 1);
  }
  return { usd, thb };
}

function buildStage1Html(items: any[]): string {
  const rows = buildRows(items);
  const total = cartTotals(items);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">You left something behind</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your MildMate cart is waiting for you</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Hi there, we noticed you added custom bedding to your cart but didn&rsquo;t complete your order.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s) \u2014 ${formatPrice(total.thb, total.usd)}</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="https://www.mildmate.com/checkout/" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Return to Your Cart</a></td></tr></table></td></tr></table></body></html>`;
}

function buildStage2Html(items: any[], discountCode: string, discountPct: number): string {
  const rows = buildRows(items);
  const total = cartTotals(items);
  const discountUsd = Math.round(total.usd * discountPct / 100);
  const checkoutUrl = 'https://www.mildmate.com/checkout/?code=' + discountCode;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Still thinking?</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Here&rsquo;s ${discountPct}% off</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Your MildMate cart is still waiting. Here&rsquo;s a special offer.</p><div style="background:#F0F9FF;border:2px dashed #2c96f4;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px"><p style="margin:0 0 8px;font-size:13px;color:#64748b">Your discount code</p><p style="margin:0;font-size:28px;font-weight:700;color:#2c96f4;letter-spacing:2px">${discountCode}</p><p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${discountPct}% off \u2014 save $${discountUsd}</p></div><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s) \u2014 ${formatPrice(total.thb, total.usd)}</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="${checkoutUrl}" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Claim ${discountPct}% Off &amp; Return to Cart</a></td></tr></table></td></tr></table></body></html>`;
}

function buildStage3Html(items: any[], discountCode: string, discountPct: number): string {
  const rows = buildRows(items);
  const total = cartTotals(items);
  const discountUsd = Math.round(total.usd * discountPct / 100);
  const checkoutUrl = 'https://www.mildmate.com/checkout/?code=' + discountCode;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#FF6B35,#E85D2C);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Last chance</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your ${discountPct}% off expires soon</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Your MildMate cart is about to expire. If you still want custom-fit bedding, now is the time.</p><div style="background:#FFF8F5;border:2px dashed #FF6B35;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px"><p style="margin:0 0 8px;font-size:13px;color:#64748b">Your discount code</p><p style="margin:0;font-size:28px;font-weight:700;color:#FF6B35;letter-spacing:2px">${discountCode}</p><p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${discountPct}% off \u2014 save $${discountUsd} &bull; expires in 3 days</p></div><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s) \u2014 ${formatPrice(total.thb, total.usd)}</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="${checkoutUrl}" style="display:inline-block;background:#FF6B35;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Use Your ${discountPct}% Off Before It Expires</a></td></tr></table></td></tr></table></body></html>`;
}

export async function handleAdminRecoveryTest(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret" } });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const auth = await authorizeAdminBrowser(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });
  }

  const url = new URL(request.url);
  const testEmail = url.searchParams.get('email') || '';
  let stage = parseInt(url.searchParams.get('stage') || '1', 10);
  if (stage !== 2 && stage !== 3) stage = 1;

  const db = env.DB;
  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500, headers });
  }

  let stageDiscount = 10;
  if (stage !== 1) {
    try {
      const { results: cfgRows } = await db.prepare("SELECT key, value FROM recovery_config WHERE key IN ('stage2_discount','stage3_discount')").all();
      const map: Record<string, string> = {};
      for (const row of (cfgRows || []) as any[]) map[row.key] = row.value;
      const raw = Number(stage === 2 ? map.stage2_discount : map.stage3_discount);
      if (Number.isFinite(raw) && raw > 0) stageDiscount = raw;
    } catch {}
  }

  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

  let query = "SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 0 AND created_at < ?";
  let params: any[] = [cutoff];

  if (testEmail) {
    query += " AND email = ?";
    params.push(testEmail);
  }
  query += " LIMIT 5";

  const { results: carts } = await db.prepare(query).bind(...params).all();

  if (!carts || carts.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No eligible abandoned carts found" }), { headers });
  }

  let sent = 0;
  let errors: string[] = [];

  for (const cart of carts as any[]) {
    try {
      let items: any[] = [];
      try { items = JSON.parse(cart.cart_json || '[]'); } catch { continue; }
      if (!items.length) continue;

      let subject: string;
      let html: string;
      if (stage === 2) {
        const code = generateTestCode();
        subject = `Still thinking? Here's ${stageDiscount}% off \u2014 your MildMate cart`;
        html = buildStage2Html(items, code, stageDiscount);
      } else if (stage === 3) {
        const code = generateTestCode();
        subject = `Last chance \u2014 your ${stageDiscount}% off expires soon`;
        html = buildStage3Html(items, code, stageDiscount);
      } else {
        subject = 'You left something behind \u2014 your MildMate cart';
        html = buildStage1Html(items);
      }

      const ok = await sendRecoveryEmail(env, cart.email, subject, html);

      // Test sends intentionally leave recovery_stage/recovery_sent_at untouched so
      // they neither advance the real funnel nor count against the daily send cap.
      if (ok) {
        sent++;
      } else {
        errors.push(`Failed to send to ${cart.email}`);
      }
    } catch (e: any) {
      errors.push(`Error for cart ${cart.id}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify({ sent, stage, total: carts.length, errors: errors.length ? errors : undefined }), { headers });
}
