// MildMate Quote API
// POST /api/quote — submit custom quote request
// Stores in custom_quotes + subscribers (dedup) + emails contact@mildmate.com

export async function handleQuote(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: any = await request.json();
    const { customer_name, email, address, telephone, product_slug, dimensions, fabric, color } = body;

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
      INSERT INTO custom_quotes (quote_id, customer_name, email, address, telephone, product_slug, dimensions, fabric, color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      quoteId, cleanName, cleanEmail,
      address?.trim() || null, telephone?.trim() || null,
      cleanSlug, dimsJson, fabric || null, color || null
    ).run();

    // Also save email to subscribers (dedup via UNIQUE constraint)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO subscribers (email, source, language) VALUES (?, 'quote', 'en')`
    ).bind(cleanEmail).run();

    // Fire-and-forget: notify contact@mildmate.com via MailChannels
    sendQuoteEmail(cleanName, cleanEmail, cleanAddress, cleanPhone, cleanSlug, dimsJson, cleanFabric, cleanColor, quoteId).catch(e => {
      console.error("Quote email failed:", e.message);
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

async function sendQuoteEmail(
  name: string, email: string, address: string, phone: string,
  slug: string, dimsJson: string, fabric: string, color: string, quoteId: string
): Promise<void> {
  let dimStr = "—";
  try {
    const d = JSON.parse(dimsJson);
    if (d.w && d.l && d.d) {
      dimStr = `${d.w} × ${d.l} × ${d.d} ${d.unit || "cm"}`;
    }
  } catch { dimStr = dimsJson; }

  const body = `New custom quote submitted from MildMate website:

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

━━━ Info ━━━
Date: ${new Date().toISOString()}
`;

  await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: "contact@mildmate.com", name: "MildMate" }],
        reply_to: { email, name },
      }],
      from: { email: "noreply@mildmate-new.pages.dev", name: "MildMate Quotes" },
      subject: `[Quote Request] ${quoteId} — ${name} (${slug})`,
      content: [{ type: "text/plain", value: body }],
    }),
  });
}
