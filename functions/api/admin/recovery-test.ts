// Admin Recovery Test — manually triggers abandoned cart recovery
// Handles at: POST /api/admin/recovery-test?stage=1|2|3&email=test@example.com
// Standalone Pages Function (not imported from workers/api/) to avoid bundling issues

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

export async function onRequest({ request, env }: any): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
      },
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const url = new URL(request.url);
  const targetStage = parseInt(url.searchParams.get('stage') || '1') || 1;
  const testEmail = url.searchParams.get('email') || '';

  if (!env.RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), { status: 500, headers });
  }

  const db = env.DB;

  // Read recovery config
  let threshold = 150, expiryDays = 60, s2Discount = 10, s3Discount = 10;
  try {
    const { results: cfgRows } = await db.prepare('SELECT key, value FROM recovery_config').all();
    if (cfgRows) {
      for (const row of cfgRows as any[]) {
        if (row.key === 'basket_threshold_usd') threshold = Number(row.value) || 150;
        if (row.key === 'discount_expiry_days') expiryDays = Number(row.value) || 60;
        if (row.key === 'stage2_discount') s2Discount = Number(row.value) || 10;
        if (row.key === 'stage3_discount') s3Discount = Number(row.value) || 10;
      }
    }
  } catch {}

  // Force-update cart to make it eligible for the target stage
  if (targetStage === 2) {
    const twoDaysAgo = new Date(Date.now() - 49 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    if (testEmail) {
      await db.prepare("UPDATE abandoned_carts SET recovery_stage = 1, recovery_sent_at = ? WHERE recovered = 0 AND recovery_stage IN (0,1) AND email = ?").bind(twoDaysAgo, testEmail).run();
    } else {
      await db.prepare("UPDATE abandoned_carts SET recovery_stage = 1, recovery_sent_at = ? WHERE recovered = 0 AND recovery_stage IN (0,1)").bind(twoDaysAgo).run();
    }
  } else if (targetStage === 3) {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    if (testEmail) {
      await db.prepare("UPDATE abandoned_carts SET recovery_stage = 2, recovery_sent_at = ? WHERE recovered = 0 AND recovery_stage IN (0,1,2) AND email = ?").bind(fiveDaysAgo, testEmail).run();
    } else {
      await db.prepare("UPDATE abandoned_carts SET recovery_stage = 2, recovery_sent_at = ? WHERE recovered = 0 AND recovery_stage IN (0,1,2)").bind(fiveDaysAgo).run();
    }
  }

  // Query for the right stage
  let query = '';
  let params: any[] = [];
  if (targetStage === 1) {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    query = "SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 0 AND created_at < ?";
    params = [cutoff];
    if (testEmail) { query += " AND email = ?"; params.push(testEmail); }
    query += " LIMIT 5";
  } else if (targetStage === 2) {
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    query = "SELECT id, email, cart_json FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 1 AND recovery_sent_at < ?";
    params = [cutoff];
    if (testEmail) { query += " AND email = ?"; params.push(testEmail); }
    query += " LIMIT 3";
  } else {
    const cutoff = new Date(Date.now() - 4 * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    query = "SELECT id, email, cart_json, discount_code FROM abandoned_carts WHERE recovered = 0 AND recovery_stage = 2 AND recovery_sent_at < ?";
    params = [cutoff];
    if (testEmail) { query += " AND email = ?"; params.push(testEmail); }
    query += " LIMIT 3";
  }

  const { results: carts } = await db.prepare(query).bind(...params).all();

  if (!carts || carts.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No eligible abandoned carts found for stage " + targetStage }), { headers });
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

      let subject = '', nextStage = 0, html = '';

      if (targetStage === 1) {
        subject = 'You left something behind \u2014 your MildMate cart';
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">You left something behind</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your MildMate cart is waiting for you</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 24px">Hi there, we noticed you added custom bedding to your cart but didn&rsquo;t complete your order.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s)</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="https://mildmate-new.pages.dev/checkout/" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Return to Your Cart</a></td></tr></table></td></tr></table></body></html>`;
        nextStage = totalUsd >= threshold ? 1 : 3;
      } else if (targetStage === 2) {
        const discountCode = 'RECOVER-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const discountUsd = Math.round(totalUsd * s2Discount / 100);
        subject = `Still thinking? Here's ${s2Discount}% off \u2014 your MildMate cart`;
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#2c96f4,#1a7fd4);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Still thinking?</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Here&rsquo;s ${s2Discount}% off to help you decide</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Your MildMate cart is still waiting. Here&rsquo;s a special offer.</p><div style="background:#F0F9FF;border:2px dashed #2c96f4;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px"><p style="margin:0 0 8px;font-size:13px;color:#64748b">Your discount code</p><p style="margin:0;font-size:28px;font-weight:700;color:#2c96f4;letter-spacing:2px">${discountCode}</p><p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${s2Discount}% off — save $${discountUsd}</p></div><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s)</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="https://mildmate-new.pages.dev/checkout/?code=${discountCode}" style="display:inline-block;background:#2c96f4;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Claim ${s2Discount}% Off &amp; Return to Cart</a></td></tr></table></td></tr></table></body></html>`;
        nextStage = 2;
        try {
          const expiresAt = new Date(Date.now() + expiryDays * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
          await db.prepare("INSERT INTO discount_claims (code, email, status, discount_pct, expires_at, source, created_at) VALUES (?, ?, 'issued', ?, ?, 'abandoned_cart', datetime('now'))").bind(discountCode, cart.email, s2Discount, expiresAt).run();
          await db.prepare("UPDATE abandoned_carts SET discount_code = ? WHERE id = ?").bind(discountCode, cart.id).run();
        } catch (e: any) {}
      } else {
        const discountCode = cart.discount_code || ('RECOVER-' + Math.random().toString(36).substring(2, 8).toUpperCase());
        const discountUsd = Math.round(totalUsd * s3Discount / 100);
        subject = `Last chance \u2014 your ${s3Discount}% off expires soon`;
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:'Quicksand',Arial,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="background:linear-gradient(135deg,#FF6B35,#E85D2C);padding:32px 24px;text-align:center"><h1 style="color:#fff;font-size:24px;font-weight:700;margin:0 0 8px">Last chance</h1><p style="color:rgba(255,255,255,0.9);font-size:15px;margin:0">Your ${s3Discount}% off discount expires soon</p></td></tr><tr><td style="padding:24px"><p style="color:#1E293B;font-size:15px;line-height:1.6;margin:0 0 16px">Your MildMate cart is about to expire. If you still want custom-fit bedding, now is the time.</p><div style="background:#FFF8F5;border:2px dashed #FF6B35;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px"><p style="margin:0 0 8px;font-size:13px;color:#64748b">Your discount code</p><p style="margin:0;font-size:28px;font-weight:700;color:#FF6B35;letter-spacing:2px">${discountCode}</p><p style="margin:8px 0 0;font-size:14px;color:#0F172A;font-weight:600">${s3Discount}% off — save $${discountUsd} &bull; expires in 3 days</p></div><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px"><tr><td colspan="2" style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:13px">${items.length} item(s)</td></tr>${rows}</table><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><a href="https://mildmate-new.pages.dev/checkout/?code=${discountCode}" style="display:inline-block;background:#FF6B35;color:#fff;font-weight:700;font-size:16px;padding:14px 40px;border-radius:8px;text-decoration:none">Use Your ${s3Discount}% Off Before It Expires</a></td></tr></table></td></tr></table></body></html>`;
        nextStage = 3;
      }

      const ok = await sendRecoveryEmail(env, cart.email, subject, html);

      if (ok) {
        await db.prepare("UPDATE abandoned_carts SET recovery_stage = ?, recovery_sent_at = datetime('now') WHERE id = ?").bind(nextStage, cart.id).run();
        sent++;
      } else {
        errors.push(`Failed to send to ${cart.email}`);
      }
    } catch (e: any) {
      errors.push(`Error for cart ${cart.id}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify({ sent, stage: targetStage, total: carts.length, errors: errors.length ? errors : undefined }), { headers });
}
