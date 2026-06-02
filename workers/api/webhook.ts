// MildMate Stripe Webhook Handler
// POST /api/webhook/stripe — receives payment confirmations from Stripe
// Saves order to D1 + sends confirmation emails via Resend
// Requires STRIPE_WEBHOOK_SECRET set as Cloudflare secret

import { sendEmail } from "./email";

async function sha256(text: string): Promise<string> {
  const d = new TextEncoder().encode(text);
  const h = await crypto.subtle.digest("SHA-256", d);
  return Array.from(new Uint8Array(h)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
}

function normalizeAddress(raw: any): string {
  var addr = raw;
  if (typeof raw === "string") try { addr = JSON.parse(raw); } catch(e) { return (raw||"").toLowerCase().trim(); }
  if (typeof addr !== "object" || !addr) return "";
  return [(addr.street||addr.address||"").trim().toLowerCase(), (addr.city||"").trim().toLowerCase(), (addr.state||addr.province||"").trim().toLowerCase(), (addr.postal_code||addr.zip||addr.postal||"").trim().toLowerCase(), (addr.country||"").trim().toLowerCase()].join("|");
}

export async function handleStripeWebhook(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await request.text();

  // Verify Stripe signature
  let event: any;
  try {
    // Manual HMAC-SHA256 verification compatible with Workers
    const parts = signature.split(",");
    const timestampPart = parts.find((p: string) => p.startsWith("t="));
    const sigPart = parts.find((p: string) => p.startsWith("v1="));
    if (!timestampPart || !sigPart) {
      throw new Error("Invalid signature format");
    }
    const timestamp = timestampPart.substring(2);
    const signedPayload = `${timestamp}.${rawBody}`;

    // Use Web Crypto API for HMAC verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = hexToArrayBuffer(sigPart.substring(3));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(signedPayload)
    );

    if (!valid) {
      throw new Error("Invalid signature");
    }

    event = JSON.parse(rawBody);
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only handle checkout.session.completed
  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = event.data.object;
  const metadata = session.metadata || {};

  let items: any[] = [];
  try {
    const rawItems = JSON.parse(metadata.items || "[]");
    items = (Array.isArray(rawItems) ? rawItems : []).map((item: any) => ({
      slug: item.slug || item.s || "",
      name: item.name || item.n || item.slug || item.s || "",
      fabric: item.fabric || item.f || null,
      color: item.color || item.c || null,
      dims: item.dims || item.d || {},
      qty: item.qty || item.q || 1,
      unit_amount: Number(item.u || item.unit_amount || 0), // minor unit (cents/satang)
    }));
  } catch {
    // continue without items
  }

  const sessionCurrency = String(session.currency || "usd").toLowerCase();
  const totalQty = items.reduce((sum: number, item: any) => sum + (item.qty || 1), 0);
  const fallbackUnitAmount = totalQty > 0 && session.amount_total
    ? Math.round(session.amount_total / totalQty)
    : 0;

  // Save each item as an order row
  for (const item of items) {
    const dims = item.dims || {};
    const unitAmount = item.unit_amount > 0 ? item.unit_amount : fallbackUnitAmount;
    const unitPriceMajor = unitAmount > 0 ? unitAmount / 100 : null;
    try {
      await env.DB.prepare(
        `INSERT INTO orders (
          stripe_session_id, stripe_payment_intent_id, email, customer_name, phone,
          shipping_address, product_slug, product_title_en, fabric, color,
          width_cm, length_cm, depth_cm, width_in, length_in, depth_in,
          custom_notes, price_usd, price_thb, currency, quantity, discount_code, status
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, 'confirmed')`
      ).bind(
        session.id,
        session.payment_intent || null,
        (metadata.email || session.customer_email || "").toLowerCase(),
        metadata.name || null,
        metadata.phone || null,
        metadata.address || null,
        item.slug || "",
        item.name || "",
        item.fabric || null,
        item.color || null,
        dims.w || null,
        dims.l || null,
        dims.d || null,
        null, null, null,
        null,
        sessionCurrency === "usd" ? unitPriceMajor : null,
        sessionCurrency === "thb" ? unitPriceMajor : null,
        sessionCurrency,
        item.qty || 1,
        metadata.discount_code || null
      ).run();

      // Mark discount code as used (one per household)
      if (metadata.discount_code) {
        try {
          var addrHash = metadata.address ? await sha256(normalizeAddress(metadata.address)) : null;
          await env.DB.prepare(
            "UPDATE discount_claims SET status = 'used', address_hash = ?, order_id = last_insert_rowid(), claimed_at = datetime('now') WHERE code = ? AND status = 'issued'"
          ).bind(addrHash, metadata.discount_code).run();
        } catch(err) { console.error('Discount claim failed:', (err as any)?.message || err); }
      }
    } catch (e: any) {
      console.error("Failed to save order:", e.message);
    }
  }

  // Mark abandoned cart as recovered
  const email = metadata.email || session.customer_email;
  if (email) {
    try {
      await env.DB.prepare(
        "UPDATE abandoned_carts SET recovered = 1 WHERE email = ?1 AND recovered = 0"
      ).bind(email).run();
    } catch {
      // non-critical
    }
  }

  // Auto-save shipping address if not already in customer_addresses
  if (email && metadata.address) {
    try {
      const existing = await env.DB.prepare(
        "SELECT id FROM customer_addresses WHERE email = ?1 AND address = ?2 LIMIT 1"
      ).bind(email, metadata.address).first();
      if (!existing) {
        const fullName = (metadata.name || "").trim();
        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";
        const addrParts = metadata.address.split(",").map((s: string) => s.trim());
        const country = addrParts[addrParts.length - 1] || "";
        const postal = addrParts.length >= 2 ? addrParts[addrParts.length - 2] : "";
        const state = addrParts.length >= 3 ? addrParts[addrParts.length - 3] : "";
        const city = addrParts.length >= 4 ? addrParts[addrParts.length - 4] : "";
        await env.DB.prepare(
          `INSERT INTO customer_addresses (email, label, first_name, last_name, phone, country, address, city, state, postal_code, is_default)
           VALUES (?1, 'Home', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)`
        ).bind(email, firstName, lastName, metadata.phone || "", country, metadata.address, city, state, postal).run();
      }
    } catch {
      // non-critical
    }
  }

  // Send confirmation emails (best-effort)
  if (email && env.RESEND_API_KEY) {
    const itemList = items.map((i: any) => {
      const dims = i.dims || {};
      return `- ${i.name} | ${i.fabric || "N/A"} | ${dims.w || "?"}\u00D7${dims.l || "?"}${dims.d ? `\u00D7${dims.d}` : ""} ${dims.unit || "cm"} | Qty: ${i.qty || 1}`;
    }).join("\n");

    const total = session.amount_total
      ? `${(session.amount_total / 100).toFixed(2)} ${session.currency?.toUpperCase() || "USD"}`
      : "N/A";

    // Customer confirmation
    try {
      const customerMail = await sendEmail(env, {
        to: email,
        subject: `Order Confirmed \u2014 MildMate #${session.id.slice(-8)}`,
        text: `Thank you for your order!\n\nOrder: #${session.id.slice(-8)}\n\nItems:\n${itemList}\n\nTotal: ${total}\n\nWe'll notify you when your order ships.\n\n\u2014 MildMate`,
      });
      if (!customerMail.success) {
        console.error("Customer email failed:", customerMail.error || "unknown error", "to:", email);
      }
    } catch (err: any) {
      console.error("Customer email exception:", err?.message || err, "to:", email);
    }

    // Team notification
    const teamEmail = env.ORDER_NOTIFICATION_EMAIL || "orders@mildmate.com";
    try {
      const teamMail = await sendEmail(env, {
        to: teamEmail,
        subject: `New Order \u2014 MildMate #${session.id.slice(-8)}`,
        text: `New order received!\n\nOrder: #${session.id.slice(-8)}\nCustomer: ${metadata.name || "Guest"} (${email})\nPhone: ${metadata.phone || "N/A"}\nAddress: ${metadata.address || "N/A"}\n\nItems:\n${itemList}\n\nTotal: ${total}`,
      });
      if (!teamMail.success) {
        console.error("Team email failed:", teamMail.error || "unknown error", "to:", teamEmail);
      }
    } catch (err: any) {
      console.error("Team email exception:", err?.message || err, "to:", teamEmail);
    }
  }

  // ── Thank-you discount: insert into queue for cron to send later ──
  if (email) {
    try {
      const { results: cfgRows } = await env.DB.prepare('SELECT key, value FROM recovery_config').all();
      let discountPct = 20, sendAfterHours = 1;
      if (cfgRows) {
        const map: Record<string, string> = {};
        for (const row of cfgRows as any[]) map[row.key] = row.value;
        discountPct = Number(map.thankyou_discount) || 20;
        sendAfterHours = Number(map.thankyou_send_after_hours) || 1;
      }

      const discountCode = 'THANKS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 365 * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      const sendAfter = new Date(Date.now() + sendAfterHours * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

      await env.DB.prepare(
        "INSERT INTO discount_claims (code, email, status, discount_pct, expires_at, source, created_at) VALUES (?, ?, 'issued', ?, ?, 'thankyou', datetime('now'))"
      ).bind(discountCode, email.toLowerCase(), discountPct, expiresAt).run();

      await env.DB.prepare(
        "INSERT INTO thankyou_queue (order_id, email, discount_code, discount_pct, send_after) VALUES (?, ?, ?, ?, ?)"
      ).bind(session.id, email.toLowerCase(), discountCode, discountPct, sendAfter).run();

      console.log(`Webhook: thankyou queued for ${email} (${discountPct}%, send after ${sendAfterHours}h)`);
    } catch (e: any) {
      console.error('Thankyou queue insert failed:', e.message);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}
