// MildMate Admin Quotes API
// GET  /api/admin/quotes         — list custom quotes
// POST /api/admin/quotes         — create quote record from sales input
// PUT  /api/admin/quotes         — update quote status/price/expiry and optionally send magic link email
//
// Auth: Clerk Bearer token (admin role) or X-Admin-Secret fallback

import { verifyClerkJwt } from "./clerk-verify";
import { sendEmail } from "./email";

let quoteSchemaReady = false;
let quoteSchemaPromise: Promise<void> | null = null;

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    },
  });
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

function isPreviewHashHost(hostname: string): boolean {
  if (!hostname) return false;
  return /^[a-f0-9]{8,}\.mildmate-new\.pages\.dev$/i.test(hostname);
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };
  add(raw.role); add(raw.roles); add(raw.org_role); add(raw.orgRole);
  add(raw.public_metadata?.role); add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.role); add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role); add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]); add(raw["https://mildmate.com/roles"]);
  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(raw: any): boolean {
  const roles = collectRoles(raw);
  return roles.some((r) =>
    r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" ||
    r.endsWith(":admin") || r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  return allow.includes(email.toLowerCase());
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");
  const host = new URL(request.url).hostname;

  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) return { ok: true };

      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey },
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch {}
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }

  // Temporary stage bypass for preview deployments only.
  // Applies to hashed preview URLs like https://<hash>.mildmate-new.pages.dev
  // and can be disabled by setting ADMIN_QUOTES_PREVIEW_BYPASS=false.
  const bypassPreview = String(env.ADMIN_QUOTES_PREVIEW_BYPASS || "true").toLowerCase() !== "false";
  if (bypassPreview && isPreviewHashHost(host)) return { ok: true };

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) return { ok: false, status: 401, error: "Unauthorized" };

  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

async function ensureQuoteSchema(env: any): Promise<void> {
  if (quoteSchemaReady) return;
  if (!quoteSchemaPromise) {
    quoteSchemaPromise = (async () => {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(custom_quotes)").all();
      const existing = new Set((tableInfo.results || []).map((r: any) => String(r.name || "").toLowerCase()));

      const alters: string[] = [];
      if (!existing.has("quote_id")) alters.push("ALTER TABLE custom_quotes ADD COLUMN quote_id TEXT");
      if (!existing.has("customer_name")) alters.push("ALTER TABLE custom_quotes ADD COLUMN customer_name TEXT");
      if (!existing.has("email")) alters.push("ALTER TABLE custom_quotes ADD COLUMN email TEXT");
      if (!existing.has("address")) alters.push("ALTER TABLE custom_quotes ADD COLUMN address TEXT");
      if (!existing.has("telephone")) alters.push("ALTER TABLE custom_quotes ADD COLUMN telephone TEXT");
      if (!existing.has("product_slug")) alters.push("ALTER TABLE custom_quotes ADD COLUMN product_slug TEXT");
      if (!existing.has("dimensions")) alters.push("ALTER TABLE custom_quotes ADD COLUMN dimensions TEXT");
      if (!existing.has("fabric")) alters.push("ALTER TABLE custom_quotes ADD COLUMN fabric TEXT");
      if (!existing.has("color")) alters.push("ALTER TABLE custom_quotes ADD COLUMN color TEXT");
      if (!existing.has("status")) alters.push("ALTER TABLE custom_quotes ADD COLUMN status TEXT DEFAULT 'pending'");
      if (!existing.has("quoted_price")) alters.push("ALTER TABLE custom_quotes ADD COLUMN quoted_price INTEGER");
      if (!existing.has("quoted_price_usd")) alters.push("ALTER TABLE custom_quotes ADD COLUMN quoted_price_usd INTEGER");
      if (!existing.has("expires_at")) alters.push("ALTER TABLE custom_quotes ADD COLUMN expires_at DATETIME");
      if (!existing.has("created_at")) alters.push("ALTER TABLE custom_quotes ADD COLUMN created_at DATETIME");
      for (const sql of alters) await env.DB.prepare(sql).run();

      const afterInfo = await env.DB.prepare("PRAGMA table_info(custom_quotes)").all();
      const after = new Set((afterInfo.results || []).map((r: any) => String(r.name || "").toLowerCase()));
      if (after.has("customer_email") && after.has("email")) {
        await env.DB.prepare("UPDATE custom_quotes SET email = COALESCE(NULLIF(email, ''), customer_email)").run();
      }
      if (after.has("product_type") && after.has("product_slug")) {
        await env.DB.prepare("UPDATE custom_quotes SET product_slug = COALESCE(NULLIF(product_slug, ''), product_type)").run();
      }
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_email ON custom_quotes(email)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_status ON custom_quotes(status)").run();
      await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_quotes_id ON custom_quotes(quote_id)").run();
      quoteSchemaReady = true;
    })().finally(() => {
      if (!quoteSchemaReady) quoteSchemaPromise = null;
    });
  }
  await quoteSchemaPromise;
}

function normalizeDateInput(input: any): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const dt = new Date(raw);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().replace("T", " ").slice(0, 19);
}

async function generateQuoteId(db: any): Promise<string> {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const datePrefix = `QT-${y}${m}${d}`;
  const row = await db.prepare("SELECT COUNT(*) as cnt FROM custom_quotes WHERE quote_id LIKE ?1").bind(`${datePrefix}-%`).first();
  const seq = String((row?.cnt || 0) + 1).padStart(3, "0");
  return `${datePrefix}-${seq}`;
}

function buildQuoteLink(request: Request, quoteId: string): string {
  const origin = new URL(request.url).origin;
  return `${origin}/quote/${encodeURIComponent(quoteId)}/`;
}

async function getUsdRate(db: any): Promise<number> {
  try {
    const row = await db.prepare(
      "SELECT param_value FROM pricing_params WHERE param_key = 'usd_rate'"
    ).first();
    if (row) {
      const val = parseFloat(row.param_value);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {}
  return 30; // default fallback
}

async function sendMagicLinkEmail(env: any, request: Request, quote: any): Promise<{ success: boolean; error?: string }> {
  if (!quote?.email) return { success: false, error: "Missing customer email" };
  if (quote.status !== "approved") return { success: false, error: "Quote is not approved" };

  const priceThb = quote.quoted_price ? Number(quote.quoted_price) : 0;
  const priceUsd = quote.quoted_price_usd ? Number(quote.quoted_price_usd) : 0;
  const hasUsdPrice = priceUsd > 0;
  if (!hasUsdPrice && priceThb <= 0) return { success: false, error: "Quoted price is required before sending email" };

  const quoteLink = buildQuoteLink(request, quote.quote_id);
  const product = String(quote.product_slug || "").replace(/-/g, " ");
  const prettyProduct = product.replace(/\b\w/g, (c) => c.toUpperCase()) || "Custom Product";
  const expires = quote.expires_at ? new Date(String(quote.expires_at).replace(" ", "T") + "Z") : null;
  const expiryText = expires && !isNaN(expires.getTime()) ? expires.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

  const priceLine = hasUsdPrice
    ? `$${priceUsd.toLocaleString()} USD (approx. ฿${priceThb.toLocaleString()} THB)`
    : `฿${priceThb.toLocaleString()} THB`;

  const body = [
    `Hi ${quote.customer_name || "there"},`,
    "",
    `Your custom quote is ready: ${quote.quote_id}`,
    `Product: ${prettyProduct}`,
    `Price: ${priceLine}`,
    expiryText ? `Valid until: ${expiryText}` : "",
    "",
    "Use this secure link to add your quote directly to cart:",
    quoteLink,
    "",
    "If you have any questions, reply to this email and our team will help.",
    "",
    "MildMate Team",
  ].filter(Boolean).join("\n");

  const result = await sendEmail(env, {
    to: String(quote.email).trim().toLowerCase(),
    from: env.QUOTE_FROM_EMAIL || "MildMate <orders@mildmate.com>",
    replyTo: env.QUOTE_REPLY_TO || "orders@mildmate.com",
    subject: `Your MildMate quote ${quote.quote_id} is ready`,
    text: body,
  });
  return { success: result.success, error: result.error };
}

export async function handleAdminQuotes(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  await ensureQuoteSchema(env);

  const db = env.DB;
  const url = new URL(request.url);
  const method = request.method;

  if (method === "GET") {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const statusFilter = String(url.searchParams.get("status") || "").trim().toLowerCase();
    const allowedStatus = new Set(["pending", "approved", "rejected", "expired", "archived"]);
    const where: string[] = [];
    const binds: any[] = [];
    if (statusFilter && statusFilter !== "all" && allowedStatus.has(statusFilter)) {
      where.push("LOWER(COALESCE(status,'pending')) = ?");
      binds.push(statusFilter);
    } else if (!statusFilter || statusFilter === "all") {
      // Default "All" view excludes archived — use "Archived" filter to see deleted quotes
      where.push("LOWER(COALESCE(status,'pending')) != 'archived'");
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const limit = 50;
    const offset = (page - 1) * limit;

    const rows = await db.prepare(
      `SELECT id, quote_id, customer_name, email, telephone, address, product_slug, dimensions, fabric, color,
              status, quoted_price, quoted_price_usd, expires_at, created_at
       FROM custom_quotes
       ${whereSql}
       ORDER BY COALESCE(created_at, datetime('now')) DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`
    ).bind(...binds).all();

    const totalRow = await db.prepare(
      `SELECT COUNT(*) as cnt FROM custom_quotes ${whereSql}`
    ).bind(...binds).first();

    const quotes = (rows.results || []).map((r: any) => {
      let dims = r.dimensions;
      try {
        dims = typeof r.dimensions === "string" ? JSON.parse(r.dimensions) : r.dimensions;
      } catch {}
      const priceThb = r.quoted_price || null;
      const priceUsd = r.quoted_price_usd || null;
      const hasExplicitUsd = priceUsd != null && priceUsd > 0;
      return {
        id: r.id,
        quote_id: r.quote_id,
        customer_name: r.customer_name || "",
        email: r.email || "",
        telephone: r.telephone || "",
        address: r.address || "",
        product_slug: r.product_slug || "",
        dimensions: dims || {},
        fabric: r.fabric || "",
        color: r.color || "",
        status: r.status || "pending",
        quoted_price_thb: priceThb,
        quoted_price_usd: priceUsd,
        quoted_price_currency: hasExplicitUsd ? "USD" : (priceThb ? "THB" : null),
        expires_at: r.expires_at || null,
        created_at: r.created_at || null,
        size_text: dims && typeof dims === "object" ? (dims.size_text || "") : "",
        quote_url: buildQuoteLink(request, r.quote_id),
      };
    });

    return json({
      quotes,
      page,
      total: totalRow?.cnt || 0,
      status: statusFilter || "all",
    });
  }

  if (method === "POST") {
    let body: any = {};
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const customerName = String(body.customer_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const productSlug = String(body.product_slug || "").trim().toLowerCase();
    const sizeText = String(body.size_text || "").trim();
    let dimensions: any = body.dimensions || null;
    if (!dimensions && sizeText) {
      dimensions = { size_text: sizeText };
    } else if (dimensions && typeof dimensions === "object" && sizeText) {
      dimensions = { ...dimensions, size_text: sizeText };
    }
    const dimsJson = typeof dimensions === "string" ? dimensions : JSON.stringify(dimensions || {});
    const status = String(body.status || "pending").trim().toLowerCase();
    const quoteCurrency = String(body.quoted_price_currency || "").trim().toUpperCase();
    const isUsdQuote = quoteCurrency === "USD";
    let quotedPriceThb: number | null = null;
    let quotedPriceUsd: number | null = null;

    if (isUsdQuote) {
      const usdVal = body.quoted_price_usd != null && body.quoted_price_usd !== ""
        ? Math.round(Number(body.quoted_price_usd))
        : null;
      if (usdVal && usdVal > 0) {
        quotedPriceUsd = usdVal;
        const rate = await getUsdRate(db);
        quotedPriceThb = Math.round(usdVal * rate);
      }
    } else {
      const thbVal = body.quoted_price_thb != null && body.quoted_price_thb !== ""
        ? Math.round(Number(body.quoted_price_thb))
        : null;
      if (thbVal && thbVal > 0) {
        quotedPriceThb = thbVal;
        const rate = await getUsdRate(db);
        quotedPriceUsd = Math.round(thbVal / rate);
      }
    }
    const expiresAt = normalizeDateInput(body.expires_at);
    const sendEmailNow = !!body.send_email;

    if (!customerName) return json({ error: "customer_name is required" }, 400);
    if (!email || !email.includes("@")) return json({ error: "Valid email is required" }, 400);
    if (!productSlug) return json({ error: "product_slug is required" }, 400);
    if (!dimensions) return json({ error: "dimensions or size_text is required" }, 400);
    if (!["pending", "approved", "rejected", "expired", "archived"].includes(status)) {
      return json({ error: "Invalid status" }, 400);
    }
    if (status === "approved" && (!quotedPriceThb || quotedPriceThb <= 0)) {
      return json({ error: "A price (THB or USD) is required for approved status" }, 400);
    }

    const quoteId = await generateQuoteId(db);
    await db.prepare(
      `INSERT INTO custom_quotes
        (quote_id, customer_name, email, address, telephone, product_slug, dimensions, fabric, color, status, quoted_price, quoted_price_usd, expires_at, created_at)
       VALUES
        (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))`
    ).bind(
      quoteId,
      customerName,
      email,
      String(body.address || "").trim() || null,
      String(body.telephone || "").trim() || null,
      productSlug,
      dimsJson,
      String(body.fabric || "").trim() || null,
      String(body.color || "").trim() || null,
      status,
      quotedPriceThb,
      quotedPriceUsd,
      expiresAt
    ).run();

    let emailStatus: any = { success: false, skipped: true };
    if (sendEmailNow && status === "approved") {
      emailStatus = await sendMagicLinkEmail(env, request, {
        quote_id: quoteId,
        customer_name: customerName,
        email,
        product_slug: productSlug,
        status,
        quoted_price: quotedPriceThb,
        quoted_price_usd: quotedPriceUsd,
        expires_at: expiresAt,
      });
    }

    return json({
      success: true,
      quote_id: quoteId,
      quote_url: buildQuoteLink(request, quoteId),
      email_sent: !!emailStatus.success,
      email_error: emailStatus.success ? null : (emailStatus.skipped ? null : (emailStatus.error || null)),
    }, 201);
  }

  if (method === "PUT") {
    let body: any = {};
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

    const quoteId = String(body.quote_id || "").trim();
    if (!quoteId) return json({ error: "quote_id is required" }, 400);

    const current = await db.prepare(
      `SELECT quote_id, dimensions, status, quoted_price, quoted_price_usd
       FROM custom_quotes
       WHERE quote_id = ?1`
    ).bind(quoteId).first();
    if (!current) return json({ error: "Quote not found" }, 404);

    const updates: string[] = [];
    const binds: any[] = [];
    const status = body.status != null ? String(body.status).trim().toLowerCase() : null;
    if (status != null) {
      if (!["pending", "approved", "rejected", "expired", "archived"].includes(status)) return json({ error: "Invalid status" }, 400);
      updates.push("status = ?");
      binds.push(status);
    }

    let priceThb: number | null = null;
    let priceUsd: number | null = null;
    const quoteCurrency = String(body.quoted_price_currency || "").trim().toUpperCase();
    const isUsdUpdate = quoteCurrency === "USD";

    if (isUsdUpdate && body.quoted_price_usd != null && body.quoted_price_usd !== "") {
      priceUsd = Math.round(Number(body.quoted_price_usd));
      if (!priceUsd || priceUsd <= 0) return json({ error: "quoted_price_usd must be a positive number" }, 400);
      const rate = await getUsdRate(db);
      priceThb = Math.round(priceUsd * rate);
      updates.push("quoted_price = ?");
      binds.push(priceThb);
      updates.push("quoted_price_usd = ?");
      binds.push(priceUsd);
    } else if (body.quoted_price_thb != null && body.quoted_price_thb !== "") {
      priceThb = Math.round(Number(body.quoted_price_thb));
      if (!priceThb || priceThb <= 0) return json({ error: "quoted_price_thb must be a positive number" }, 400);
      updates.push("quoted_price = ?");
      binds.push(priceThb);
      // Clear explicit USD since seller switched to THB
      updates.push("quoted_price_usd = NULL");
    }
    if (body.expires_at !== undefined) {
      const normalized = normalizeDateInput(body.expires_at);
      updates.push("expires_at = ?");
      binds.push(normalized);
    }
    if (body.fabric !== undefined) {
      updates.push("fabric = ?");
      binds.push(String(body.fabric || "").trim() || null);
    }
    if (body.color !== undefined) {
      updates.push("color = ?");
      binds.push(String(body.color || "").trim() || null);
    }
    if (body.dimensions !== undefined || body.size_text !== undefined) {
      let dims: any = {};
      if (body.dimensions !== undefined) {
        if (typeof body.dimensions === "string") {
          try { dims = JSON.parse(body.dimensions); } catch { return json({ error: "Invalid dimensions JSON" }, 400); }
        } else if (body.dimensions && typeof body.dimensions === "object") {
          dims = body.dimensions;
        } else {
          dims = {};
        }
      } else {
        try {
          dims = typeof current.dimensions === "string" ? JSON.parse(current.dimensions || "{}") : (current.dimensions || {});
        } catch {
          dims = {};
        }
      }
      if (body.size_text !== undefined) {
        const txt = String(body.size_text || "").trim();
        if (txt) dims.size_text = txt;
        else delete dims.size_text;
      }
      updates.push("dimensions = ?");
      binds.push(JSON.stringify(dims || {}));
    }

    const targetStatus = status || String(current.status || "pending").toLowerCase();
    const finalPriceThb = priceThb != null ? priceThb : Number(current.quoted_price || 0);
    if (targetStatus === "approved" && (!finalPriceThb || finalPriceThb <= 0)) {
      return json({ error: "A price (THB or USD) is required for approved status" }, 400);
    }

    if (!updates.length && !body.send_email) return json({ error: "No update fields provided" }, 400);

    if (updates.length) {
      await db.prepare(`UPDATE custom_quotes SET ${updates.join(", ")} WHERE quote_id = ?`).bind(...binds, quoteId).run();
    }

    const row = await db.prepare(
      `SELECT quote_id, customer_name, email, product_slug, status, quoted_price, quoted_price_usd, expires_at
       FROM custom_quotes
       WHERE quote_id = ?1`
    ).bind(quoteId).first();

    if (!row) return json({ error: "Quote not found" }, 404);

    let emailStatus: any = { success: false, skipped: true };
    if (body.send_email) {
      emailStatus = await sendMagicLinkEmail(env, request, row);
      if (!emailStatus.success) {
        return json({
          error: emailStatus.error || "Failed to send quote email",
          quote_id: quoteId,
        }, 400);
      }
    }

    return json({
      success: true,
      quote_id: quoteId,
      quote_url: buildQuoteLink(request, quoteId),
      email_sent: !!emailStatus.success,
    });
  }

  return json({ error: "Method not allowed" }, 405);
}
