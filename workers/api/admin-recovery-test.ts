// Admin Recovery Test — manually triggers abandoned cart recovery email
// POST /api/admin/recovery-test?email=test@example.com

async function sendRecoveryEmail(env: any, to: string, subject: string, html: string): Promise<boolean> {
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
    return resp.ok;
  } catch (e: any) {
    return false;
  }
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

export async function handleAdminRecoveryTest(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret" } });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const url = new URL(request.url);
  const testEmail = url.searchParams.get('email') || '';

  const db = env.DB;
  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500, headers });
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

      let totalUsd = 0;
      for (const item of items) totalUsd += (item.price_usd || 0) * (item.qty || 1);

      let rows = '';
      items.forEach((item: any) => {
        const dims = item.dimensions ? [item.dimensions.w, item.dimensions.l, item.dimensions.d].filter(Boolean).join('\u00D7') + ' ' + (item.dimensions.unit || 'cm') : '';
        const specs = [item.fabric, item.color, dims].filter(Boolean).join(' \u00B7 ');
        rows += `<tr><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0"><div style="font-weight:700;color:#0F172A;font-size:15px">${escHtml(item.product_name || 'Custom Order')}</div>${specs ? `<div style="font-size:13px;color:#64748b;margin-top:2px">${escHtml(specs)}</div>` : ''}</td><td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:15px">${formatPrice(item.price_thb, item.price_usd)}</td></tr>`;
      });

      const subject = 'You left something behind \u2014 your MildMate cart';
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">You left something behind</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your MildMate cart is waiting for you</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Hi there, we noticed you added custom bedding to your cart but didn&rsquo;t complete your order.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s)</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="https://mildmate-new.pages.dev/checkout/" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Return to Your Cart</a></td></tr></table></td></tr></table></body></html>`;

      const ok = await sendRecoveryEmail(env, cart.email, subject, html);

      if (ok) {
        await db.prepare("UPDATE abandoned_carts SET recovery_sent_at = datetime('now') WHERE id = ?").bind(cart.id).run();
        sent++;
      } else {
        errors.push(`Failed to send to ${cart.email}`);
      }
    } catch (e: any) {
      errors.push(`Error for cart ${cart.id}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify({ sent, total: carts.length, errors: errors.length ? errors : undefined }), { headers });
}
