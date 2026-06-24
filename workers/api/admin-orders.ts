// MildMate Admin API — Orders management
// GET  /api/admin/orders     — list all orders
// GET  /api/admin/orders/:id — single order
// PUT  /api/admin/orders/:id — update status
//
// Auth strategy:
// 1) Prefer Clerk Bearer token with admin/super-admin role claim
// 2) Optional X-Admin-Secret fallback for local/dev (or explicitly enabled in prod)

import { verifyClerkJwt } from "./clerk-verify";
import { sendEmail } from "./email";

let orderShippingSchemaReady = false;
let orderShippingSchemaPromise: Promise<void> | null = null;

const TRACKING_URL_BY_CARRIER: Record<string, string> = {
  thaipost: "https://track.thailandpost.co.th",
  flash: "https://www.flashexpress.co.th/fle/tracking",
  dhl: "https://www.dhl.com/us-en/home.html",
  ups: "https://www.ups.com/track?TypeOfInquiryNumber=T&InquiryNumber1={TRACKING}",
  fedex: "https://www.fedex.com/en-us/tracking.html",
  usps: "https://tools.usps.com/tracking/{TRACKING}",
};

const CARRIER_ALIAS: Record<string, string> = {
  thailandpost: "thaipost",
  "thailand post": "thaipost",
  thai: "thaipost",
  "thai post": "thaipost",
  flashexpress: "flash",
  "flash express": "flash",
  dhlexpress: "dhl",
  "dhl express": "dhl",
  unitedparcelservice: "ups",
  "united parcel service": "ups",
  fedexexpress: "fedex",
  "fed ex": "fedex",
  unitedstatespostalservice: "usps",
  "united states postal service": "usps",
};

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function ensureOrderShippingSchema(env: any): Promise<void> {
  if (orderShippingSchemaReady) return;
  if (!orderShippingSchemaPromise) {
    orderShippingSchemaPromise = (async () => {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(orders)").all();
      const existing = new Set(
        (tableInfo.results || []).map((r: any) => String(r.name || "").toLowerCase())
      );
      const alters: string[] = [];
      if (!existing.has("carrier_code")) alters.push("ALTER TABLE orders ADD COLUMN carrier_code TEXT");
      if (!existing.has("tracking_number")) alters.push("ALTER TABLE orders ADD COLUMN tracking_number TEXT");
      if (!existing.has("tracking_url")) alters.push("ALTER TABLE orders ADD COLUMN tracking_url TEXT");
      if (!existing.has("shipping_status")) alters.push("ALTER TABLE orders ADD COLUMN shipping_status TEXT");
      if (!existing.has("shipped_at")) alters.push("ALTER TABLE orders ADD COLUMN shipped_at DATETIME");
      if (!existing.has("customer_note_type")) alters.push("ALTER TABLE orders ADD COLUMN customer_note_type TEXT");
      if (!existing.has("customer_note")) alters.push("ALTER TABLE orders ADD COLUMN customer_note TEXT");
      for (const sql of alters) await env.DB.prepare(sql).run();
      orderShippingSchemaReady = true;
    })().finally(() => {
      if (!orderShippingSchemaReady) orderShippingSchemaPromise = null;
    });
  }
  await orderShippingSchemaPromise;
}

function normalizeCarrier(raw: any): string {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!v) return "";
  if (TRACKING_URL_BY_CARRIER[v]) return v;
  const compact = v.replace(/\s+/g, "");
  if (TRACKING_URL_BY_CARRIER[compact]) return compact;
  return CARRIER_ALIAS[v] || CARRIER_ALIAS[compact] || compact;
}

function buildTrackingUrl(carrierCode: string, trackingNumber: string): string {
  const tpl = TRACKING_URL_BY_CARRIER[carrierCode];
  if (!tpl) return "";
  return tpl.replace("{TRACKING}", encodeURIComponent(trackingNumber));
}

function carrierLabel(carrierCode: string): string {
  const labels: Record<string, string> = {
    thaipost: "Thailand Post",
    flash: "Flash Express",
    dhl: "DHL",
    ups: "UPS",
    fedex: "FedEx",
    usps: "USPS",
  };
  return labels[carrierCode] || carrierCode.toUpperCase();
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return false;
  if (hostname.endsWith(".local")) return false;
  return hostname === "www.mildmate.com" || hostname === "mildmate.com";
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };

  add((raw as any).role);
  add((raw as any).roles);
  add((raw as any).org_role);
  add((raw as any).orgRole);
  add((raw as any).public_metadata?.role);
  add((raw as any).public_metadata?.roles);
  add((raw as any).unsafe_metadata?.role);
  add((raw as any).unsafe_metadata?.roles);
  add((raw as any).metadata?.role);
  add((raw as any).metadata?.roles);
  add((raw as any)["https://mildmate.com/role"]);
  add((raw as any)["https://mildmate.com/roles"]);

  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(rawClaims: any): boolean {
  const roles = collectRoles(rawClaims);
  return roles.some((r) =>
    r === "admin" ||
    r === "super-admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r.endsWith(":admin") ||
    r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const hasBearer = authHeader.startsWith("Bearer ");

  // 1) Preferred: Clerk Bearer token
  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) {
      // Continue to secret fallback below (useful during migration/dev)
    } else {
      const raw = verified.payload.raw || {};
      // Check JWT claims first (fallback for custom templates that include email/metadata)
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) {
        return { ok: true };
      }
      // JWT lacks email/metadata — look up user via Clerk Backend API
      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find(function(e: any) { return e.id === user.primary_email_address_id; })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch(e: any) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }

  // 2) Legacy fallback: X-Admin-Secret
  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const configuredSecret = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!providedSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  // Dev bypass: if ADMIN_SECRET not set, allow any non-empty secret
  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

export async function handleAdminOrders(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  try {
    await ensureOrderShippingSchema(env);
  } catch (e: any) {
    console.error("orders shipping schema init failed:", e?.message || e);
    return json({ error: "Orders schema unavailable" }, 500);
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  const method = request.method;

  // GET /api/admin/orders — list all orders, newest first
  if (method === "GET" && path === "/api/admin/orders") {
    const db = env.DB;
    const result = await db.prepare(
      `SELECT id, stripe_session_id, stripe_payment_intent_id,
              email, customer_name, phone, shipping_address,
              product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm,
              width_in, length_in, depth_in,
              custom_notes, customer_note_type, customer_note, price_usd, price_thb, currency,
              status, created_at,
              carrier_code, tracking_number, tracking_url,
              shipping_status, shipped_at
       FROM orders
       ORDER BY created_at DESC`
    ).all();

    return json({ orders: result.results });
  }

  // GET /api/admin/orders/:id — single order detail
  const idMatch = path.match(/^\/api\/admin\/orders\/(\d+)$/);
  if (method === "GET" && idMatch) {
    const orderId = parseInt(idMatch[1]);
    const db = env.DB;
    const result = await db.prepare(
      `SELECT id, stripe_session_id, stripe_payment_intent_id,
              email, customer_name, phone, shipping_address,
              product_slug, product_title_en, fabric, color,
              width_cm, length_cm, depth_cm,
              width_in, length_in, depth_in,
              custom_notes, customer_note_type, customer_note, price_usd, price_thb, currency,
              status, created_at,
              carrier_code, tracking_number, tracking_url,
              shipping_status, shipped_at
       FROM orders
       WHERE id = ?`
    ).bind(orderId).first();

    if (!result) {
      return json({ error: "Order not found" }, 404);
    }

    return json({ order: result });
  }

  // PUT /api/admin/orders/:id — update order status
  if (method === "PUT" && idMatch) {
    const orderId = parseInt(idMatch[1]);
    const body: any = await request.json();
    const newStatus = body.status;

    if (!newStatus) {
      return json({ error: "status field required" }, 400);
    }

    const validStatuses = ["pending", "production", "shipped", "cancelled", "confirmed"];
    if (validStatuses.indexOf(newStatus) === -1) {
      return json({ error: "Invalid status. Must be one of: " + validStatuses.join(", ") }, 400);
    }

    const db = env.DB;
    const currentOrder = await db.prepare(
      `SELECT id, stripe_session_id, email, customer_name, product_title_en
       FROM orders
       WHERE id = ?1`
    ).bind(orderId).first();
    if (!currentOrder) {
      return json({ error: "Order not found" }, 404);
    }

    if (newStatus === "shipped") {
      const carrierCode = normalizeCarrier(body.carrier_code);
      const trackingNumber = String(body.tracking_number || "").trim();
      if (!carrierCode || !TRACKING_URL_BY_CARRIER[carrierCode]) {
        return json({ error: "carrier_code is required for shipped status" }, 400);
      }
      if (!trackingNumber) {
        return json({ error: "tracking_number is required for shipped status" }, 400);
      }

      const trackingUrl = String(body.tracking_url || "").trim() || buildTrackingUrl(carrierCode, trackingNumber);
      const shippingStatus = String(body.shipping_status || "in_transit").trim().toLowerCase();
      const shippedAt = String(body.shipped_at || "").trim() || new Date().toISOString();

      await db.prepare(
        `UPDATE orders
         SET status = ?1,
             carrier_code = ?2,
             tracking_number = ?3,
             tracking_url = ?4,
             shipping_status = ?5,
             shipped_at = ?6
         WHERE id = ?7`
      ).bind(newStatus, carrierCode, trackingNumber, trackingUrl, shippingStatus, shippedAt, orderId).run();

      if (currentOrder.email && env.RESEND_API_KEY) {
        const orderCode = String(currentOrder.stripe_session_id || orderId).slice(-8);
        const customerName = String(currentOrder.customer_name || "").trim();
        const greeting = customerName ? `Hi ${customerName},` : "Hi,";
        const productLine = currentOrder.product_title_en
          ? `Item: ${currentOrder.product_title_en}\n`
          : "";
        const trackingLine = `${carrierLabel(carrierCode)}: ${trackingNumber}`;
        const emailText =
          `${greeting}\n\n` +
          `Great news — your MildMate order #${orderCode} has shipped.\n\n` +
          `${productLine}` +
          `Tracking: ${trackingLine}\n` +
          `Track package: ${trackingUrl}\n\n` +
          `Thank you for shopping with MildMate.`;
        try {
          await sendEmail(env, {
            to: String(currentOrder.email),
            subject: `Your order has shipped — MildMate #${orderCode}`,
            text: emailText,
          });
        } catch (e: any) {
          console.error("Shipped email failed:", e?.message || e);
        }
      }

      return json({
        ok: true,
        id: orderId,
        status: newStatus,
        carrier_code: carrierCode,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        shipping_status: shippingStatus,
        shipped_at: shippedAt,
      });
    }

    await db.prepare("UPDATE orders SET status = ? WHERE id = ?")
      .bind(newStatus, orderId).run();

    return json({ ok: true, id: orderId, status: newStatus });
  }

  // OPTIONS — CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret, Authorization",
      },
    });
  }

  return json({ error: "Method not allowed" }, 405);
}
