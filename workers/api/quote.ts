// MildMate Quote API
// POST /api/quote — submit custom quote request
// Stores in custom_quotes + subscribers (dedup) + emails contact@mildmate.com via Resend
// Anti-spam: honeypot field + IP rate limit (3/hour)

import { sendEmail } from "./email";

const QUOTE_RATE_LIMIT = 5; // max per hour per IP
const QUOTE_RATE_WINDOW = "-1 hour";

async function checkRateLimit(db: any, ip: string, endpoint: string, max: number): Promise<boolean> {
  const row = await db.prepare(
    `SELECT COUNT(*) as cnt FROM rate_limits WHERE ip_address = ? AND endpoint = ? AND created_at > datetime('now', ?)`
  ).bind(ip, endpoint, QUOTE_RATE_WINDOW).first();
  return (row?.cnt || 0) >= max;
}

export async function handleQuote(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: any = await request.json();
    const { customer_name, email, address, telephone, product_slug, dimensions, fabric, color, quoted_price_thb, quoted_price_usd, _website } = body;

    // ── Honeypot check — bots auto-fill hidden fields ──
    if (_website && _website.length > 0) {
      // Silently accept to not tip off the bot
      return new Response(JSON.stringify({ success: true, message: "Quote submitted." }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── IP rate limit ──
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (await checkRateLimit(env.DB, ip, "quote", QUOTE_RATE_LIMIT)) {
      return new Response(JSON.stringify({
        error: "Too many requests. Please try again later."
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!customer_name || !customer_name.trim()) {
      return new Response(JSON.stringify({ error: "Customer name is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (!product_slug) {
      return new Response(JSON.stringify({ error: "Product is required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    if (!dimensions) {
      return new Response(JSON.stringify({ error: "Dimensions are required" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const y = String(now.getFullYear()).slice(2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const datePrefix = `QT-${y}${m}${d}`;

    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM custom_quotes WHERE quote_id LIKE ?`
    ).bind(`${datePrefix}-%`).first();
    const seq = String((countResult?.cnt || 0) + 1).padStart(3, "0");
    const quoteId = `${datePrefix}-${seq}`;

    const dimsJson = typeof dimensions === "string" ? dimensions : JSON.stringify(dimensions);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = customer_name.trim();
    const cleanAddress = address?.trim() || "—";
    const cleanPhone = telephone?.trim() || "—";
    const cleanFabric = fabric || "—";
    const cleanColor = color || "—";
    const cleanSlug = product_slug;

    await env.DB.prepare(`
      INSERT INTO custom_quotes (quote_id, customer_name, email, address, telephone, product_slug, dimensions, fabric, color, quoted_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      quoteId, cleanName, cleanEmail,
      address?.trim() || null, telephone?.trim() || null,
      cleanSlug, dimsJson, fabric || null, color || null,
      quoted_price_thb || null
    ).run();

    // Also save email to subscribers (dedup via UNIQUE constraint)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO subscribers (email, source, language) VALUES (?, 'quote', 'en')`
    ).bind(cleanEmail).run();

    // Record rate limit entry
    await env.DB.prepare(
      `INSERT INTO rate_limits (ip_address, endpoint) VALUES (?, 'quote')`
    ).bind(ip).run();

    // Fire-and-forget: notify contact@mildmate.com via Resend
    const emailBody = buildQuoteEmail(cleanName, cleanEmail, cleanAddress, cleanPhone, cleanSlug, dimsJson, cleanFabric, cleanColor, quoteId, quoted_price_thb, quoted_price_usd);
    sendEmail(env, {
      to: "contact@mildmate.com",
      replyTo: cleanEmail,
      subject: `[Quote Request] ${quoteId} — ${cleanName} (${cleanSlug})`,
      text: emailBody,
    }).catch(e => {
      console.error("Quote email failed:", e);
    });

    return new Response(JSON.stringify({
      success: true,
      quote_id: quoteId,
      message: `Quote submitted. We'll email ${cleanEmail} within 24 hours.`,
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Quote API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function buildQuoteEmail(
  name: string, email: string, address: string, phone: string,
  slug: string, dimsJson: string, fabric: string, color: string,
  quoteId: string, priceThb: number | null, priceUsd: number | null
): string {
  let dimStr = "—";
  try {
    const d = JSON.parse(dimsJson);
    if (d.w && d.l && d.d) {
      dimStr = `${d.w} × ${d.l} × ${d.d} ${d.unit || "cm"}`;
    }
  } catch { dimStr = dimsJson; }

  let priceLine = "—";
  if (priceUsd != null && priceUsd > 0) {
    const usd = Number(priceUsd).toFixed(2);
    const thb = priceThb != null ? ` (฿${priceThb.toLocaleString()})` : "";
    priceLine = `$${usd} USD${thb}`;
  }

  return `New custom quote submitted from MildMate website:

Quote ID: ${quoteId}
Product: ${slug}

━━━ Customer ━━━
Name: ${name}
Email: ${email}
Address: ${address}
Telephone: ${phone}

━━━ Order ━━━
Dimensions: ${dimStr}
Fabric: ${fabric}
Color: ${color}
Price: ${priceLine}
`;
}
