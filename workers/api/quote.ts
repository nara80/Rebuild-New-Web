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
  const url = new URL(request.url);

  // GET /api/quote?quote_id=QT-XXXXX — fetch a quote by ID (magic link)
  if (request.method === "GET") {
    const quoteId = url.searchParams.get("quote_id");
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quote_id parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const row = await env.DB.prepare(
        `SELECT quote_id, customer_name, email, product_slug, dimensions, fabric, color,
                status, quoted_price, expires_at, created_at
         FROM custom_quotes
         WHERE quote_id = ?1`
      ).bind(quoteId).first();

      if (!row) {
        return new Response(JSON.stringify({ error: "Quote not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      let dimensions: any = {};
      try {
        dimensions = typeof row.dimensions === "string" ? JSON.parse(row.dimensions) : row.dimensions;
      } catch {}

      // Get exchange rate for USD display
      let usdRate = 30;
      try {
        const rateRow = await env.DB.prepare(
          "SELECT param_value FROM pricing_params WHERE param_key = 'usd_rate'"
        ).first();
        if (rateRow) {
          const val = parseFloat(rateRow.param_value);
          if (!isNaN(val)) usdRate = val;
        }
      } catch {}

      const priceThb = row.quoted_price || null;
      const priceUsd = priceThb ? Math.round(priceThb / usdRate) : null;

      return new Response(JSON.stringify({
        quote_id: row.quote_id,
        customer_name: row.customer_name,
        product_slug: row.product_slug,
        dimensions,
        fabric: row.fabric,
        color: row.color,
        status: row.status,
        quoted_price_thb: priceThb,
        quoted_price_usd: priceUsd,
        expires_at: row.expires_at,
        created_at: row.created_at,
        is_expired: row.expires_at ? new Date(row.expires_at + "Z") < new Date() : false,
        is_approved: row.status === "approved",
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Quote GET error:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

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
      INSERT INTO custom_quotes (quote_id, customer_name, email, address, telephone, product_slug, dimensions, fabric, color, quoted_price, quoted_price_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      quoteId, cleanName, cleanEmail,
      address?.trim() || null, telephone?.trim() || null,
      cleanSlug, dimsJson, fabric || null, color || null,
      quoted_price_thb || null,
      quoted_price_usd || null
    ).run();

    // Also save email to subscribers (dedup via UNIQUE constraint)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO subscribers (email, source, language) VALUES (?, 'quote', 'en')`
    ).bind(cleanEmail).run();

    // Record rate limit entry
    await env.DB.prepare(
      `INSERT INTO rate_limits (ip_address, endpoint) VALUES (?, 'quote')`
    ).bind(ip).run();

    // Notify contact@mildmate.com via Resend
    const emailBody = buildQuoteEmail(cleanName, cleanEmail, cleanAddress, cleanPhone, cleanSlug, dimsJson, cleanFabric, cleanColor, quoteId, quoted_price_thb, quoted_price_usd);
    let emailStatus = "not_sent";
    try {
      const emailResult = await sendEmail(env, {
        to: "contact@mildmate.com",
        from: env.QUOTE_FROM_EMAIL || "MildMate <orders@mildmate.com>",
        replyTo: cleanEmail,
        subject: `[Quote Request] ${quoteId} — ${cleanName} (${cleanSlug})`,
        text: emailBody,
      });
      emailStatus = emailResult.success ? "sent" : "failed";
      if (!emailResult.success) {
        console.error("Quote email failed:", emailResult.error);
      }
    } catch (e: any) {
      emailStatus = "error";
      console.error("Quote email failed:", e.message || e);
    }

    return new Response(JSON.stringify({
      success: true,
      quote_id: quoteId,
      message: `Quote submitted. We'll email ${cleanEmail} within 24 hours.`,
      _debug_email: emailStatus,
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
  let shapeLine = "";
  let areaLine = "";
  try {
    const d: any = JSON.parse(dimsJson);
    if (d && typeof d === "object") {
      const unit = d.unit || "cm";
      if (d.shape_code || d.shape_name || d.values) {
        const shapeCode = d.shape_code ? String(d.shape_code) : "";
        const shapeName = d.shape_name ? String(d.shape_name) : "";
        if (shapeCode || shapeName) {
          shapeLine = `Boat Mattress Shape: ${shapeCode}${shapeCode && shapeName ? ". " : ""}${shapeName}`.trim();
        }
        if (d.area_cm2 && Number(d.area_cm2) > 0) {
          areaLine = `Top Area: ${Number(d.area_cm2).toLocaleString()} cm²`;
        }
        if (d.values && typeof d.values === "object") {
          const order = ["A", "B", "C", "D", "E", "F", "G", "H", "W", "L", "T"];
          const keys = Object.keys(d.values).sort((a, b) => {
            const ai = order.indexOf(a);
            const bi = order.indexOf(b);
            if (ai === -1 && bi === -1) return a.localeCompare(b);
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
          });
          dimStr = keys.map((k) => `${k}: ${d.values[k]} ${unit}`).join("\n");
        } else {
          dimStr = JSON.stringify(d);
        }
      } else if (d.w && d.l) {
        dimStr = d.d ? `${d.w} × ${d.l} × ${d.d} ${unit}` : `${d.w} × ${d.l} ${unit}`;
      } else {
        dimStr = JSON.stringify(d);
      }
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
${shapeLine ? `${shapeLine}\n` : ""}Dimensions${dimStr.includes("\n") ? ":" : `: ${dimStr}`}
${dimStr.includes("\n") ? `${dimStr}\n` : ""}${areaLine ? `${areaLine}\n` : ""}Fabric: ${fabric}
Color: ${color}
Price: ${priceLine}
`;
}
