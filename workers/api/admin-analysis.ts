// MildMate Admin API — Marketing Analysis (read-only)
// Phase 04 of the Marketing Decision System.
//
// GET /api/admin/analysis/summary       ?start&end&channel
// GET /api/admin/analysis/sales         ?start&end&channel&product_id&status&revenue_status&limit&offset
// GET /api/admin/analysis/products      ?start&end&channel
// GET /api/admin/analysis/product/:id
// GET /api/admin/analysis/channels      ?start&end
// GET /api/admin/analysis/data-quality
// GET /api/admin/analysis/gsc           ?start&end&product_id
// GET /api/admin/analysis/ga4           ?start&end&product_id
// GET /api/admin/analysis/etsy          ?start&end&product_id
// GET /api/admin/analysis/google-ads    ?start&end&product_id
// GET /api/admin/analysis/growth-signals?start&end&channel&product_id
// GET /api/admin/analysis/profitability ?start&end&channel
// GET  /api/admin/analysis/opportunity            — Phase 14 latest score snapshot (read-only)
// POST /api/admin/analysis/opportunity/recompute  — Phase 14 recompute (dashboard button; cron uses the same core)
//
// Reads analysis_* views (plus selected supporting tables/products for titles).
// Metric semantics: 01_MildMate_Marketing/02_Metric_Dictionary/Phase_02_Metric_Contract_2026-09-07.md
// No PII: the unified sales tables carry no customer fields.

import { verifyClerkJwt } from "./clerk-verify";
import { getOpportunity, recomputeOpportunityHandler } from "./admin-opportunity";

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function err(code: string, message: string, status = 400): Response {
  return json({ success: false, error_code: code, message }, status);
}

// ── Auth (same pattern as admin-stats.ts) ─────────────────────────────────

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

  if (hasBearer) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) {
      // continue to secret fallback
    } else {
      const raw = (verified.payload as any).raw || {};
      if (hasAdminRole(raw) || emailAllowed((verified.payload as any).email || "", env)) {
        return { ok: true };
      }
      const sub = (verified.payload as any).sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey },
          });
          if (clerkResp.ok) {
            const user: any = await clerkResp.json();
            const email = user.email_addresses?.find(function (e: any) { return e.id === user.primary_email_address_id; })?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch (e: any) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }

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

  if (!configuredSecret) return { ok: true };
  if (providedSecret === configuredSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

// ── Parameter validation ──────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHANNEL_RE = /^[a-z0-9-]{1,30}$/;
const COMMERCIAL_STATUSES = new Set(["paid", "processing", "shipped", "completed"]);
const REVENUE_STATUSES = new Set(["EXACT", "UNALLOCATED"]);
const MAPPING_STATUSES = new Set(["Mapped", "Partial", "Unmapped", "Itemless"]);
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

type Filters = {
  start: string | null;
  end: string | null;
  channel: string | null;
  productId: number | null;
  status: string | null;
  revenueStatus: string | null;
  mapping: string | null;
  limit: number;
  offset: number;
};

function parseFilters(url: URL): { ok: true; f: Filters } | { ok: false; res: Response } {
  const bad = (code: string, msg: string) => ({ ok: false as const, res: err(code, msg) });

  const start = (url.searchParams.get("start") || "").trim() || null;
  if (start && !DATE_RE.test(start)) return bad("INVALID_START_DATE", "start must be YYYY-MM-DD.");
  const end = (url.searchParams.get("end") || "").trim() || null;
  if (end && !DATE_RE.test(end)) return bad("INVALID_END_DATE", "end must be YYYY-MM-DD.");
  if (start && end && start > end) return bad("INVALID_DATE_RANGE", "start must be on or before end.");

  const channelRaw = (url.searchParams.get("channel") || "").trim().toLowerCase() || null;
  if (channelRaw && !CHANNEL_RE.test(channelRaw)) return bad("INVALID_CHANNEL", "channel must be lowercase letters, digits, or hyphens.");

  const pidRaw = (url.searchParams.get("product_id") || "").trim();
  let productId: number | null = null;
  if (pidRaw) {
    if (!/^\d{1,9}$/.test(pidRaw)) return bad("INVALID_PRODUCT_ID", "product_id must be a positive integer.");
    productId = Number(pidRaw);
  }

  const statusRaw = (url.searchParams.get("status") || "").trim().toLowerCase() || null;
  if (statusRaw && !COMMERCIAL_STATUSES.has(statusRaw)) {
    return bad("INVALID_STATUS", "status must be one of: paid, processing, shipped, completed (analysis covers commercial orders only).");
  }

  const revRaw = (url.searchParams.get("revenue_status") || "").trim().toUpperCase() || null;
  if (revRaw && !REVENUE_STATUSES.has(revRaw)) return bad("INVALID_REVENUE_STATUS", "revenue_status must be EXACT or UNALLOCATED.");

  const mapRaw0 = (url.searchParams.get("mapping") || "").trim();
  const mapRaw = mapRaw0 ? mapRaw0.charAt(0).toUpperCase() + mapRaw0.slice(1).toLowerCase() : null;
  if (mapRaw && !MAPPING_STATUSES.has(mapRaw)) return bad("INVALID_MAPPING_STATUS", "mapping must be Mapped, Partial, Unmapped, or Itemless.");

  const limitRaw = (url.searchParams.get("limit") || "").trim();
  let limit = DEFAULT_LIMIT;
  if (limitRaw) {
    if (!/^\d{1,4}$/.test(limitRaw) || Number(limitRaw) < 1) return bad("INVALID_LIMIT", "limit must be a positive integer.");
    limit = Math.min(Number(limitRaw), MAX_LIMIT);
  }
  const offsetRaw = (url.searchParams.get("offset") || "").trim();
  let offset = 0;
  if (offsetRaw) {
    if (!/^\d{1,9}$/.test(offsetRaw)) return bad("INVALID_OFFSET", "offset must be a non-negative integer.");
    offset = Number(offsetRaw);
  }

  return {
    ok: true,
    f: { start, end, channel: channelRaw, productId, status: statusRaw, revenueStatus: revRaw, mapping: mapRaw, limit, offset },
  };
}

function dayRangeWhere(f: Filters, col = "order_day"): { sql: string; binds: any[] } {
  const parts: string[] = [];
  const binds: any[] = [];
  if (f.start) { parts.push(`${col} >= ?`); binds.push(f.start); }
  if (f.end) { parts.push(`${col} <= ?`); binds.push(f.end); }
  return { sql: parts.length ? " AND " + parts.join(" AND ") : "", binds };
}

function shiftIsoDate(isoDay: string, deltaDays: number): string | null {
  if (!DATE_RE.test(isoDay)) return null;
  const d = new Date(isoDay + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// ── Endpoints ─────────────────────────────────────────────────────────────

async function getSummary(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f);
  const binds: any[] = [...range.binds];
  let channelSql = "";
  if (f.channel) { channelSql = " AND channel_norm = ?"; binds.push(f.channel); }

  const row: any = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(orders), 0)            AS orders,
       SUM(order_revenue)                  AS order_revenue,
       COALESCE(SUM(units), 0)             AS units,
       COALESCE(SUM(mapped_orders), 0)     AS mapped_orders,
       COALESCE(SUM(exact_items), 0)       AS exact_items,
       COALESCE(SUM(unallocated_items), 0) AS unallocated_items
     FROM analysis_sales_daily
     WHERE 1=1${range.sql}${channelSql}`
  ).bind(...binds).first();

  const orders = Number(row?.orders || 0);
  const revenue = row?.order_revenue === null || row?.order_revenue === undefined ? null : Number(row.order_revenue);
  const items = Number(row?.exact_items || 0) + Number(row?.unallocated_items || 0);

  return json({
    success: true,
    filters: { start: f.start, end: f.end, channel: f.channel },
    summary: {
      orders,
      order_revenue: revenue,
      currency: "THB",
      units: Number(row?.units || 0),
      aov: orders > 0 && revenue !== null ? Math.round((revenue / orders) * 100) / 100 : null,
      mapped_orders: Number(row?.mapped_orders || 0),
      mapped_order_pct: orders > 0 ? Math.round((Number(row?.mapped_orders || 0) / orders) * 1000) / 10 : null,
      exact_items: Number(row?.exact_items || 0),
      unallocated_items: Number(row?.unallocated_items || 0),
      exact_item_pct: items > 0 ? Math.round((Number(row?.exact_items || 0) / items) * 1000) / 10 : null,
      unallocated_item_pct: items > 0 ? Math.round((Number(row?.unallocated_items || 0) / items) * 1000) / 10 : null,
    },
  });
}

async function getSales(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "ai.order_day");
  const conds: string[] = [];
  const binds: any[] = [...range.binds];
  if (f.channel) { conds.push("ai.channel_norm = ?"); binds.push(f.channel); }
  if (f.productId !== null) { conds.push("ai.product_id = ?"); binds.push(f.productId); }
  if (f.revenueStatus) { conds.push("ai.revenue_status = ?"); binds.push(f.revenueStatus); }
  if (f.status) { conds.push("co.status = ?"); binds.push(f.status); }
  if (f.mapping) { conds.push("om.derived_mapping_status = ?"); binds.push(f.mapping); }
  const extra = conds.length ? " AND " + conds.join(" AND ") : "";

  const base =
    `FROM analysis_active_items ai
     JOIN analysis_commercial_orders co ON co.id = ai.sales_order_id
     LEFT JOIN analysis_order_mapping om ON om.sales_order_id = ai.sales_order_id
     LEFT JOIN products p ON p.id = ai.product_id
     WHERE 1=1${range.sql}${extra}`;

  const countRow: any = await env.DB.prepare(`SELECT COUNT(*) AS n ${base}`).bind(...binds).first();
  const total = Number(countRow?.n || 0);

  const rows = await env.DB.prepare(
    `SELECT
       ai.order_day, ai.channel_norm, co.source_system, co.source_order_id, co.status,
       co.order_total, co.currency,
       ai.product_id, COALESCE(p.title_en, '(unmapped)') AS product_title,
       ai.quantity, ai.raw_item_text,
       ai.line_revenue, ai.revenue_status,
       om.derived_mapping_status
     ${base}
     ORDER BY ai.order_day DESC, ai.sales_order_id DESC, ai.id
     LIMIT ? OFFSET ?`
  ).bind(...binds, f.limit, f.offset).all();

  return json({
    success: true,
    filters: {
      start: f.start, end: f.end, channel: f.channel, product_id: f.productId,
      status: f.status, revenue_status: f.revenueStatus, mapping: f.mapping,
    },
    pagination: { total, limit: f.limit, offset: f.offset },
    rows: rows.results || [],
  });
}

async function getProducts(env: any, f: Filters): Promise<Response> {
  // Date/channel-filtered participation is aggregated from the base item view
  // (the all-time participation view cannot be parameterized).
  const range = dayRangeWhere(f, "ai.order_day");
  const binds: any[] = [...range.binds];
  let channelSql = "";
  if (f.channel) { channelSql = " AND ai.channel_norm = ?"; binds.push(f.channel); }

  const rows = await env.DB.prepare(
    `SELECT
       ai.product_id,
       COALESCE(p.title_en, '(unmapped)') AS product_title,
       p.slug AS product_slug,
       COUNT(DISTINCT ai.sales_order_id) AS orders_containing_product,
       SUM(ai.quantity) AS quantity,
       SUM(CASE WHEN ai.revenue_status = 'EXACT' THEN ai.line_revenue END) AS exact_revenue,
       SUM(ai.revenue_status = 'EXACT') AS exact_items,
       COUNT(*) AS total_items,
       COUNT(DISTINCT ai.channel_norm) AS channel_count
     FROM analysis_active_items ai
     LEFT JOIN products p ON p.id = ai.product_id
     WHERE 1=1${range.sql}${channelSql}
     GROUP BY ai.product_id, p.title_en, p.slug
     ORDER BY orders_containing_product DESC, quantity DESC, ai.product_id`
  ).bind(...binds).all();

  const trend = await env.DB.prepare(
    `SELECT product_id, orders_28d, orders_prev_28d, growth_vs_previous FROM analysis_sales_28d`
  ).all();
  const trendMap: Record<string, any> = {};
  (trend.results || []).forEach((t: any) => { trendMap[String(t.product_id)] = t; });

  const topChannel = await env.DB.prepare(
    `SELECT product_id, channel_norm, orders, units
     FROM analysis_product_channel
     ORDER BY orders DESC, units DESC, channel_norm`
  ).all();
  const topMap: Record<string, string> = {};
  (topChannel.results || []).forEach((t: any) => {
    const k = String(t.product_id);
    if (!(k in topMap)) topMap[k] = t.channel_norm;
  });

  const out = (rows.results || []).map((r: any) => {
    const k = String(r.product_id);
    return {
      ...r,
      revenue_coverage_pct: Number(r.total_items || 0) > 0
        ? Math.round((Number(r.exact_items || 0) / Number(r.total_items)) * 1000) / 10
        : null,
      top_channel: topMap[k] || null,
      orders_28d: trendMap[k]?.orders_28d ?? 0,
      growth_vs_previous_28d: trendMap[k]?.growth_vs_previous ?? null,
    };
  });

  return json({
    success: true,
    filters: { start: f.start, end: f.end, channel: f.channel },
    products: out,
  });
}

async function getProductDetail(env: any, idRaw: string): Promise<Response> {
  if (!/^\d{1,9}$/.test(idRaw)) return err("INVALID_PRODUCT_ID", "product id must be a positive integer.");
  const pid = Number(idRaw);

  const product: any = await env.DB.prepare(
    `SELECT id, slug, title_en, product_type, is_active FROM products WHERE id = ?`
  ).bind(pid).first();
  if (!product) return err("PRODUCT_NOT_FOUND", "No product with id " + pid + ".", 404);

  const participation: any = await env.DB.prepare(
    `SELECT orders_containing_product, quantity, exact_revenue, exact_items, total_items, channel_count
     FROM analysis_product_participation WHERE product_id = ?`
  ).bind(pid).first();

  const channels = await env.DB.prepare(
    `SELECT channel_norm, orders, units, exact_revenue
     FROM analysis_product_channel WHERE product_id = ? ORDER BY orders DESC, units DESC`
  ).bind(pid).all();

  const w28: any = await env.DB.prepare(`SELECT * FROM analysis_sales_28d WHERE product_id = ?`).bind(pid).first();
  const w90: any = await env.DB.prepare(`SELECT * FROM analysis_sales_90d WHERE product_id = ?`).bind(pid).first();

  const anchorOrders = Number(participation?.orders_containing_product || 0);
  const pairs = await env.DB.prepare(
    `SELECT
       CASE WHEN cp.product_a = ?1 THEN cp.product_b ELSE cp.product_a END AS partner_product_id,
       COALESCE(p.title_en, '(unknown)') AS partner_title,
       cp.co_orders
     FROM analysis_product_copurchase cp
     LEFT JOIN products p ON p.id = CASE WHEN cp.product_a = ?1 THEN cp.product_b ELSE cp.product_a END
     WHERE cp.product_a = ?1 OR cp.product_b = ?1
     ORDER BY cp.co_orders DESC`
  ).bind(pid).all();

  const coPurchase = (pairs.results || []).map((r: any) => ({
    ...r,
    attach_rate_pct: anchorOrders > 0 ? Math.round((Number(r.co_orders) / anchorOrders) * 1000) / 10 : null,
  }));

  return json({
    success: true,
    product,
    participation: participation || {
      orders_containing_product: 0, quantity: 0, exact_revenue: null,
      exact_items: 0, total_items: 0, channel_count: 0,
    },
    channels: channels.results || [],
    window_28d: w28 || null,
    window_90d: w90 || null,
    co_purchase: coPurchase,
  });
}

async function getChannels(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f);
  const rows = await env.DB.prepare(
    `SELECT
       channel_norm,
       SUM(orders) AS orders,
       SUM(order_revenue) AS order_revenue,
       SUM(units) AS units,
       CASE WHEN SUM(orders) > 0 THEN ROUND(SUM(order_revenue) * 1.0 / SUM(orders), 2) END AS aov,
       SUM(mapped_orders) AS mapped_orders,
       CASE WHEN SUM(orders) > 0 THEN ROUND(SUM(mapped_orders) * 100.0 / SUM(orders), 1) END AS mapped_pct
     FROM analysis_sales_daily
     WHERE 1=1${range.sql}
     GROUP BY channel_norm
     ORDER BY orders DESC, order_revenue DESC`
  ).bind(...range.binds).all();

  return json({
    success: true,
    filters: { start: f.start, end: f.end },
    channels: rows.results || [],
  });
}

async function getGsc(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "g.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND g.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT g.query_norm) AS queries,
         COUNT(DISTINCT g.page_path) AS pages,
         COALESCE(SUM(g.clicks), 0) AS clicks,
         COALESCE(SUM(g.impressions), 0) AS impressions,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
         END AS avg_position,
         COALESCE(SUM(CASE WHEN g.product_id IS NOT NULL THEN g.clicks ELSE 0 END), 0) AS mapped_clicks,
         COALESCE(SUM(CASE WHEN g.product_id IS NOT NULL THEN g.impressions ELSE 0 END), 0) AS mapped_impressions
       FROM gsc_search_daily g
       WHERE 1=1${range.sql}${productSql}`
    ).bind(...binds).first();

    const topPages = await env.DB.prepare(
      `SELECT
         g.page_path,
         g.product_id,
         COALESCE(p.title_en, '(non-product)') AS product_title,
         COUNT(DISTINCT g.query_norm) AS queries,
         SUM(g.clicks) AS clicks,
         SUM(g.impressions) AS impressions,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
         END AS avg_position
       FROM gsc_search_daily g
       LEFT JOIN products p ON p.id = g.product_id
       WHERE 1=1${range.sql}${productSql}
       GROUP BY g.page_path, g.product_id, p.title_en
       ORDER BY SUM(g.clicks) DESC, SUM(g.impressions) DESC, g.page_path
       LIMIT 15`
    ).bind(...binds).all();

    const topQueries = await env.DB.prepare(
      `SELECT
         MIN(g.query_text) AS query_text,
         COUNT(DISTINCT g.page_path) AS pages,
         SUM(g.clicks) AS clicks,
         SUM(g.impressions) AS impressions,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(g.impressions) > 0
              THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
         END AS avg_position
       FROM gsc_search_daily g
       WHERE 1=1${range.sql}${productSql}
       GROUP BY g.query_norm
       ORDER BY SUM(g.clicks) DESC, SUM(g.impressions) DESC, MIN(g.query_text)
       LIMIT 20`
    ).bind(...binds).all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_gsc_freshness`).first();
    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      clicks_28d: 0,
      impressions_28d: 0,
      ctr_28d: null,
      avg_position_28d: null,
      clicks_prev_28d: 0,
      impressions_prev_28d: 0,
      ctr_prev_28d: null,
      avg_position_prev_28d: null,
      clicks_growth_pct: null,
      impressions_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND g.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }
        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.clicks), 0) AS clicks,
             COALESCE(SUM(g.impressions), 0) AS impressions,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
             END AS ctr_pct,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
             END AS avg_position
           FROM gsc_search_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${productTrendSql}`
        ).bind(...curBinds).first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.clicks), 0) AS clicks,
             COALESCE(SUM(g.impressions), 0) AS impressions,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(g.clicks) * 100.0 / SUM(g.impressions), 2)
             END AS ctr_pct,
             CASE WHEN SUM(g.impressions) > 0
                  THEN ROUND(SUM(COALESCE(g.position, 0) * g.impressions) * 1.0 / SUM(g.impressions), 2)
             END AS avg_position
           FROM gsc_search_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${productTrendSql}`
        ).bind(...prevBinds).first();

        const prevClicks = Number(prev?.clicks || 0);
        const prevImpr = Number(prev?.impressions || 0);
        const curClicks = Number(cur?.clicks || 0);
        const curImpr = Number(cur?.impressions || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          clicks_28d: curClicks,
          impressions_28d: curImpr,
          ctr_28d: cur?.ctr_pct === null || cur?.ctr_pct === undefined ? null : Number(cur.ctr_pct),
          avg_position_28d: cur?.avg_position === null || cur?.avg_position === undefined ? null : Number(cur.avg_position),
          clicks_prev_28d: prevClicks,
          impressions_prev_28d: prevImpr,
          ctr_prev_28d: prev?.ctr_pct === null || prev?.ctr_pct === undefined ? null : Number(prev.ctr_pct),
          avg_position_prev_28d: prev?.avg_position === null || prev?.avg_position === undefined ? null : Number(prev.avg_position),
          clicks_growth_pct: prevClicks > 0 ? Math.round(((curClicks - prevClicks) * 10000) / prevClicks) / 100 : null,
          impressions_growth_pct: prevImpr > 0 ? Math.round(((curImpr - prevImpr) * 10000) / prevImpr) / 100 : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const gscDays = fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
      ? null
      : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    const latestSyncAt = fresh?.last_sync_at || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (gscDays !== null && gscDays > 4) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        queries: Number(summary?.queries || 0),
        pages: Number(summary?.pages || 0),
        clicks: Number(summary?.clicks || 0),
        impressions: Number(summary?.impressions || 0),
        ctr_pct: summary?.ctr_pct === null || summary?.ctr_pct === undefined ? null : Number(summary.ctr_pct),
        avg_position: summary?.avg_position === null || summary?.avg_position === undefined ? null : Number(summary.avg_position),
        mapped_clicks: Number(summary?.mapped_clicks || 0),
        mapped_impressions: Number(summary?.mapped_impressions || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: gscDays,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: latestSyncAt,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat: "GSC data is typically delayed by 1–2 days; freshness warning threshold = 4 days.",
      },
      top_pages: topPages.results || [],
      top_queries: topQueries.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such table: gsc_search_daily") || msg.includes("no such table: analysis_gsc_freshness")) {
      return json({
        success: true,
        available: false,
        message: "GSC schema is not available in this environment yet. Apply migration 046_gsc_analytics.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("GSC_QUERY_FAILED", msg, 500);
  }
}

async function getGa4(env: any, f: Filters): Promise<Response> {
  const GA4_SCOPE_WHERE = " AND g.property_scope = 'website' AND g.landing_page_path NOT LIKE '%/listing/%'";
  const range = dayRangeWhere(f, "g.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND g.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT g.landing_page_path) AS landing_pages,
         COUNT(DISTINCT g.page_path) AS page_paths,
         COALESCE(SUM(g.sessions), 0) AS sessions,
         COALESCE(SUM(g.users), 0) AS users,
         COALESCE(SUM(g.engaged_sessions), 0) AS engaged_sessions,
         COALESCE(SUM(g.product_views), 0) AS product_views,
         COALESCE(SUM(g.add_to_cart), 0) AS add_to_cart,
         COALESCE(SUM(g.begin_checkout), 0) AS begin_checkout,
         COALESCE(SUM(g.purchases), 0) AS purchases,
         COALESCE(SUM(COALESCE(g.purchase_revenue, 0)), 0) AS purchase_revenue,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.engaged_sessions) * 100.0 / SUM(g.sessions), 2)
         END AS engagement_rate_pct,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.add_to_cart) * 100.0 / SUM(g.sessions), 2)
         END AS add_to_cart_rate_pct,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.begin_checkout) * 100.0 / SUM(g.sessions), 2)
         END AS checkout_rate_pct,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
         END AS purchase_rate_pct,
         COALESCE(SUM(CASE WHEN g.product_id IS NOT NULL THEN g.sessions ELSE 0 END), 0) AS mapped_sessions
       FROM ga4_funnel_daily g
       WHERE 1=1${GA4_SCOPE_WHERE}${range.sql}${productSql}`
    )
      .bind(...binds)
      .first();

    const topPages = await env.DB.prepare(
      `SELECT
         g.landing_page_path,
         g.page_path,
         g.product_id,
         COALESCE(p.title_en, '(non-product)') AS product_title,
         SUM(g.sessions) AS sessions,
         SUM(g.users) AS users,
         SUM(g.product_views) AS product_views,
         SUM(g.add_to_cart) AS add_to_cart,
         SUM(g.begin_checkout) AS begin_checkout,
         SUM(g.purchases) AS purchases,
         SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue,
         CASE WHEN SUM(g.sessions) > 0
              THEN ROUND(SUM(g.purchases) * 100.0 / SUM(g.sessions), 2)
         END AS purchase_rate_pct
       FROM ga4_funnel_daily g
       LEFT JOIN products p ON p.id = g.product_id
       WHERE 1=1${GA4_SCOPE_WHERE}${range.sql}${productSql}
       GROUP BY g.landing_page_path, g.page_path, g.product_id, p.title_en
       ORDER BY SUM(g.sessions) DESC, SUM(g.purchases) DESC
       LIMIT 15`
    )
      .bind(...binds)
      .all();

    const bySource = await env.DB.prepare(
      `SELECT
         CASE
           WHEN length(trim(g.source)) = 0 THEN '(direct)'
           WHEN length(trim(g.medium)) = 0 THEN lower(g.source)
           ELSE lower(g.source) || ' / ' || lower(g.medium)
         END AS source_medium,
         SUM(g.sessions) AS sessions,
         SUM(g.purchases) AS purchases,
         SUM(COALESCE(g.purchase_revenue, 0)) AS purchase_revenue
       FROM ga4_funnel_daily g
       WHERE 1=1${GA4_SCOPE_WHERE}${range.sql}${productSql}
       GROUP BY source_medium
       ORDER BY SUM(g.sessions) DESC, SUM(g.purchases) DESC
       LIMIT 12`
    )
      .bind(...binds)
      .all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_ga4_freshness`).first();
    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      sessions_28d: 0,
      product_views_28d: 0,
      add_to_cart_28d: 0,
      begin_checkout_28d: 0,
      purchases_28d: 0,
      purchase_revenue_28d: 0,
      sessions_prev_28d: 0,
      product_views_prev_28d: 0,
      add_to_cart_prev_28d: 0,
      begin_checkout_prev_28d: 0,
      purchases_prev_28d: 0,
      purchase_revenue_prev_28d: 0,
      sessions_growth_pct: null,
      purchases_growth_pct: null,
      purchase_revenue_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND g.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }

        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.sessions), 0) AS sessions,
             COALESCE(SUM(g.product_views), 0) AS product_views,
             COALESCE(SUM(g.add_to_cart), 0) AS add_to_cart,
             COALESCE(SUM(g.begin_checkout), 0) AS begin_checkout,
             COALESCE(SUM(g.purchases), 0) AS purchases,
             COALESCE(SUM(COALESCE(g.purchase_revenue, 0)), 0) AS purchase_revenue
           FROM ga4_funnel_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${GA4_SCOPE_WHERE}${productTrendSql}`
        )
          .bind(...curBinds)
          .first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(g.sessions), 0) AS sessions,
             COALESCE(SUM(g.product_views), 0) AS product_views,
             COALESCE(SUM(g.add_to_cart), 0) AS add_to_cart,
             COALESCE(SUM(g.begin_checkout), 0) AS begin_checkout,
             COALESCE(SUM(g.purchases), 0) AS purchases,
             COALESCE(SUM(COALESCE(g.purchase_revenue, 0)), 0) AS purchase_revenue
           FROM ga4_funnel_daily g
           WHERE g.report_date >= ? AND g.report_date <= ?${GA4_SCOPE_WHERE}${productTrendSql}`
        )
          .bind(...prevBinds)
          .first();

        const prevSessions = Number(prev?.sessions || 0);
        const prevPurchases = Number(prev?.purchases || 0);
        const prevRevenue = Number(prev?.purchase_revenue || 0);
        const curSessions = Number(cur?.sessions || 0);
        const curPurchases = Number(cur?.purchases || 0);
        const curRevenue = Number(cur?.purchase_revenue || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          sessions_28d: curSessions,
          product_views_28d: Number(cur?.product_views || 0),
          add_to_cart_28d: Number(cur?.add_to_cart || 0),
          begin_checkout_28d: Number(cur?.begin_checkout || 0),
          purchases_28d: curPurchases,
          purchase_revenue_28d: curRevenue,
          sessions_prev_28d: prevSessions,
          product_views_prev_28d: Number(prev?.product_views || 0),
          add_to_cart_prev_28d: Number(prev?.add_to_cart || 0),
          begin_checkout_prev_28d: Number(prev?.begin_checkout || 0),
          purchases_prev_28d: prevPurchases,
          purchase_revenue_prev_28d: prevRevenue,
          sessions_growth_pct: prevSessions > 0 ? Math.round(((curSessions - prevSessions) * 10000) / prevSessions) / 100 : null,
          purchases_growth_pct: prevPurchases > 0 ? Math.round(((curPurchases - prevPurchases) * 10000) / prevPurchases) / 100 : null,
          purchase_revenue_growth_pct: prevRevenue > 0 ? Math.round(((curRevenue - prevRevenue) * 10000) / prevRevenue) / 100 : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const ga4Days =
      fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
        ? null
        : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (ga4Days !== null && ga4Days > 3) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        landing_pages: Number(summary?.landing_pages || 0),
        page_paths: Number(summary?.page_paths || 0),
        sessions: Number(summary?.sessions || 0),
        users: Number(summary?.users || 0),
        engaged_sessions: Number(summary?.engaged_sessions || 0),
        product_views: Number(summary?.product_views || 0),
        add_to_cart: Number(summary?.add_to_cart || 0),
        begin_checkout: Number(summary?.begin_checkout || 0),
        purchases: Number(summary?.purchases || 0),
        purchase_revenue: Number(summary?.purchase_revenue || 0),
        engagement_rate_pct:
          summary?.engagement_rate_pct === null || summary?.engagement_rate_pct === undefined
            ? null
            : Number(summary.engagement_rate_pct),
        add_to_cart_rate_pct:
          summary?.add_to_cart_rate_pct === null || summary?.add_to_cart_rate_pct === undefined
            ? null
            : Number(summary.add_to_cart_rate_pct),
        checkout_rate_pct:
          summary?.checkout_rate_pct === null || summary?.checkout_rate_pct === undefined
            ? null
            : Number(summary.checkout_rate_pct),
        purchase_rate_pct:
          summary?.purchase_rate_pct === null || summary?.purchase_rate_pct === undefined
            ? null
            : Number(summary.purchase_rate_pct),
        mapped_sessions: Number(summary?.mapped_sessions || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: ga4Days,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: fresh?.last_sync_at || null,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat: "GA4 event data may finalize with delay; freshness warning threshold = 3 days.",
      },
      top_pages: topPages.results || [],
      top_sources: bySource.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.includes("no such table: ga4_funnel_daily") ||
      msg.includes("no such table: analysis_ga4_freshness") ||
      msg.includes("no such column: g.property_scope")
    ) {
      return json({
        success: true,
        available: false,
        message: "GA4 schema is not available in this environment yet. Apply migrations 048_ga4_analytics.sql and 055_ga4_multi_property.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("GA4_QUERY_FAILED", msg, 500);
  }
}

async function getEtsy(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "e.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND e.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT e.listing_id) AS listings,
         COUNT(DISTINCT CASE WHEN e.is_active = 1 THEN e.listing_id END) AS active_listings,
         COALESCE(SUM(e.visits), 0) AS visits,
         COALESCE(SUM(e.views), 0) AS views,
         COALESCE(SUM(e.favorites), 0) AS favorites,
         COALESCE(SUM(e.orders), 0) AS orders,
         COALESCE(SUM(e.transactions), 0) AS transactions,
         COALESCE(SUM(e.units_sold), 0) AS units_sold,
         COALESCE(SUM(COALESCE(e.revenue, 0)), 0) AS revenue,
         COALESCE(SUM(COALESCE(e.revenue_thb, 0)), 0) AS revenue_thb,
         COALESCE(SUM(CASE WHEN e.product_id IS NOT NULL THEN e.views ELSE 0 END), 0) AS mapped_views,
         COALESCE(SUM(CASE WHEN e.product_id IS NOT NULL THEN e.orders ELSE 0 END), 0) AS mapped_orders
       FROM etsy_listing_daily e
       WHERE 1=1${range.sql}${productSql}`
    )
      .bind(...binds)
      .first();

    const topListings = await env.DB.prepare(
      `SELECT
         e.listing_id,
         MIN(e.listing_title) AS listing_title,
         MIN(e.listing_state) AS listing_state,
         MAX(e.is_active) AS is_active,
         MIN(e.currency) AS currency,
         e.product_id,
         COALESCE(p.title_en, '(unmapped)') AS product_title,
         SUM(e.visits) AS visits,
         SUM(e.views) AS views,
         SUM(e.favorites) AS favorites,
         SUM(e.orders) AS orders,
         SUM(e.transactions) AS transactions,
         SUM(e.units_sold) AS units_sold,
         SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
       FROM etsy_listing_daily e
       LEFT JOIN products p ON p.id = e.product_id
       WHERE 1=1${range.sql}${productSql}
       GROUP BY e.listing_id, e.product_id, p.title_en
       ORDER BY SUM(e.views) DESC, SUM(e.orders) DESC, e.listing_id
       LIMIT 20`
    )
      .bind(...binds)
      .all();

    const topProducts = await env.DB.prepare(
      `SELECT
         e.product_id,
         p.slug AS product_slug,
         p.title_en AS product_title,
         COUNT(DISTINCT e.listing_id) AS listing_count,
         SUM(e.visits) AS visits,
         SUM(e.views) AS views,
         SUM(e.favorites) AS favorites,
         SUM(e.orders) AS orders,
         SUM(e.transactions) AS transactions,
         SUM(e.units_sold) AS units_sold,
         SUM(COALESCE(e.revenue_thb, 0)) AS revenue_thb
       FROM etsy_listing_daily e
       JOIN products p ON p.id = e.product_id
       WHERE e.product_id IS NOT NULL${range.sql}${productSql}
       GROUP BY e.product_id, p.slug, p.title_en
       ORDER BY SUM(e.views) DESC, SUM(e.orders) DESC, e.product_id
       LIMIT 15`
    )
      .bind(...binds)
      .all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_etsy_freshness`).first();
    const statusRow: any = await env.DB.prepare(`SELECT * FROM analysis_etsy_listing_status`).first();
    const byState = await env.DB.prepare(
      `SELECT
         listing_state,
         is_active,
         COUNT(*) AS listings,
         SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) AS mapped_listings
       FROM etsy_listing_master
       GROUP BY listing_state, is_active
       ORDER BY listings DESC, listing_state`
    ).all();

    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      views_28d: 0,
      favorites_28d: 0,
      orders_28d: 0,
      transactions_28d: 0,
      units_sold_28d: 0,
      revenue_thb_28d: 0,
      views_prev_28d: 0,
      favorites_prev_28d: 0,
      orders_prev_28d: 0,
      transactions_prev_28d: 0,
      units_sold_prev_28d: 0,
      revenue_thb_prev_28d: 0,
      views_growth_pct: null,
      orders_growth_pct: null,
      revenue_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND e.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }

        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(e.views), 0) AS views,
             COALESCE(SUM(e.favorites), 0) AS favorites,
             COALESCE(SUM(e.orders), 0) AS orders,
             COALESCE(SUM(e.transactions), 0) AS transactions,
             COALESCE(SUM(e.units_sold), 0) AS units_sold,
             COALESCE(SUM(COALESCE(e.revenue_thb, 0)), 0) AS revenue_thb
           FROM etsy_listing_daily e
           WHERE e.report_date >= ? AND e.report_date <= ?${productTrendSql}`
        )
          .bind(...curBinds)
          .first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(e.views), 0) AS views,
             COALESCE(SUM(e.favorites), 0) AS favorites,
             COALESCE(SUM(e.orders), 0) AS orders,
             COALESCE(SUM(e.transactions), 0) AS transactions,
             COALESCE(SUM(e.units_sold), 0) AS units_sold,
             COALESCE(SUM(COALESCE(e.revenue_thb, 0)), 0) AS revenue_thb
           FROM etsy_listing_daily e
           WHERE e.report_date >= ? AND e.report_date <= ?${productTrendSql}`
        )
          .bind(...prevBinds)
          .first();

        const prevViews = Number(prev?.views || 0);
        const prevOrders = Number(prev?.orders || 0);
        const prevRevenue = Number(prev?.revenue_thb || 0);
        const curViews = Number(cur?.views || 0);
        const curOrders = Number(cur?.orders || 0);
        const curRevenue = Number(cur?.revenue_thb || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          views_28d: curViews,
          favorites_28d: Number(cur?.favorites || 0),
          orders_28d: curOrders,
          transactions_28d: Number(cur?.transactions || 0),
          units_sold_28d: Number(cur?.units_sold || 0),
          revenue_thb_28d: curRevenue,
          views_prev_28d: prevViews,
          favorites_prev_28d: Number(prev?.favorites || 0),
          orders_prev_28d: prevOrders,
          transactions_prev_28d: Number(prev?.transactions || 0),
          units_sold_prev_28d: Number(prev?.units_sold || 0),
          revenue_thb_prev_28d: prevRevenue,
          views_growth_pct: prevViews > 0 ? Math.round(((curViews - prevViews) * 10000) / prevViews) / 100 : null,
          orders_growth_pct: prevOrders > 0 ? Math.round(((curOrders - prevOrders) * 10000) / prevOrders) / 100 : null,
          revenue_growth_pct: prevRevenue > 0 ? Math.round(((curRevenue - prevRevenue) * 10000) / prevRevenue) / 100 : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const etsyDays =
      fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
        ? null
        : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (etsyDays !== null && etsyDays > 7) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        listings: Number(summary?.listings || 0),
        active_listings: Number(summary?.active_listings || 0),
        visits: Number(summary?.visits || 0),
        views: Number(summary?.views || 0),
        favorites: Number(summary?.favorites || 0),
        orders: Number(summary?.orders || 0),
        transactions: Number(summary?.transactions || 0),
        units_sold: Number(summary?.units_sold || 0),
        revenue: Number(summary?.revenue || 0),
        revenue_thb: Number(summary?.revenue_thb || 0),
        mapped_views: Number(summary?.mapped_views || 0),
        mapped_orders: Number(summary?.mapped_orders || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: etsyDays,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: fresh?.last_sync_at || null,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat: "Etsy metrics depend on source exports/API windows; freshness warning threshold = 7 days.",
      },
      listing_status: {
        total_listings: Number(statusRow?.total_listings || 0),
        active_listings: Number(statusRow?.active_listings || 0),
        inactive_listings: Number(statusRow?.inactive_listings || 0),
        mapped_listings: Number(statusRow?.mapped_listings || 0),
        unmapped_listings: Number(statusRow?.unmapped_listings || 0),
        last_listing_sync_at: statusRow?.last_listing_sync_at || null,
        by_state: byState.results || [],
      },
      top_listings: topListings.results || [],
      top_products: topProducts.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.includes("no such table: etsy_listing_daily") ||
      msg.includes("no such table: etsy_listing_master") ||
      msg.includes("no such table: analysis_etsy_freshness")
    ) {
      return json({
        success: true,
        available: false,
        message: "Etsy schema is not available in this environment yet. Apply migration 049_etsy_analytics.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("ETSY_QUERY_FAILED", msg, 500);
  }
}

async function getGoogleAds(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f, "a.report_date");
  const binds: any[] = [...range.binds];
  let productSql = "";
  if (f.productId !== null) {
    productSql = " AND a.product_id = ?";
    binds.push(f.productId);
  }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(DISTINCT a.campaign_id) AS campaigns,
         COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_groups,
         COALESCE(SUM(a.impressions), 0) AS impressions,
         COALESCE(SUM(a.clicks), 0) AS clicks,
         COALESCE(SUM(a.cost), 0) AS cost,
         COALESCE(SUM(a.conversions), 0) AS conversions,
         COALESCE(SUM(a.conversion_value), 0) AS conversion_value,
         COALESCE(SUM(COALESCE(a.all_conversions, 0)), 0) AS all_conversions,
         COALESCE(SUM(COALESCE(a.all_conversions_value, 0)), 0) AS all_conversions_value,
         CASE WHEN SUM(a.impressions) > 0
              THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(a.clicks) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
         END AS cpc,
         CASE WHEN SUM(a.conversions) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
         END AS cpa,
         CASE WHEN SUM(a.cost) > 0
              THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
         END AS roas,
         COALESCE(SUM(CASE WHEN a.product_id IS NOT NULL THEN a.cost ELSE 0 END), 0) AS mapped_cost
       FROM google_ads_campaign_daily a
       WHERE 1=1${range.sql}${productSql}`
    )
      .bind(...binds)
      .first();

    const topCampaigns = await env.DB.prepare(
      `SELECT
         a.campaign_id,
         MIN(a.campaign_name) AS campaign_name,
         a.ad_group_id,
         MIN(a.ad_group_name) AS ad_group_name,
         MIN(a.channel_type) AS channel_type,
         MIN(a.network) AS network,
         MIN(a.device) AS device,
         a.product_id,
         COALESCE(p.title_en, '(unmapped)') AS product_title,
         SUM(a.impressions) AS impressions,
         SUM(a.clicks) AS clicks,
         SUM(a.cost) AS cost,
         SUM(a.conversions) AS conversions,
         SUM(a.conversion_value) AS conversion_value,
         CASE WHEN SUM(a.impressions) > 0
              THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(a.clicks) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
         END AS cpc,
         CASE WHEN SUM(a.conversions) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
         END AS cpa,
         CASE WHEN SUM(a.cost) > 0
              THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
         END AS roas
       FROM google_ads_campaign_daily a
       LEFT JOIN products p ON p.id = a.product_id
       WHERE 1=1${range.sql}${productSql}
       GROUP BY a.campaign_id, a.ad_group_id, a.product_id, p.title_en
       ORDER BY SUM(a.cost) DESC, SUM(a.conversions) DESC, a.campaign_id
       LIMIT 20`
    )
      .bind(...binds)
      .all();

    const topProducts = await env.DB.prepare(
      `SELECT
         a.product_id,
         p.slug AS product_slug,
         p.title_en AS product_title,
         COUNT(DISTINCT a.campaign_id) AS campaign_count,
         COUNT(DISTINCT CASE WHEN length(trim(a.ad_group_id)) > 0 THEN a.ad_group_id END) AS ad_group_count,
         SUM(a.impressions) AS impressions,
         SUM(a.clicks) AS clicks,
         SUM(a.cost) AS cost,
         SUM(a.conversions) AS conversions,
         SUM(a.conversion_value) AS conversion_value,
         CASE WHEN SUM(a.impressions) > 0
              THEN ROUND(SUM(a.clicks) * 100.0 / SUM(a.impressions), 2)
         END AS ctr_pct,
         CASE WHEN SUM(a.clicks) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.clicks), 2)
         END AS cpc,
         CASE WHEN SUM(a.conversions) > 0
              THEN ROUND(SUM(a.cost) / SUM(a.conversions), 2)
         END AS cpa,
         CASE WHEN SUM(a.cost) > 0
              THEN ROUND(SUM(a.conversion_value) / SUM(a.cost), 2)
         END AS roas
       FROM google_ads_campaign_daily a
       JOIN products p ON p.id = a.product_id
       WHERE a.product_id IS NOT NULL${range.sql}${productSql}
       GROUP BY a.product_id, p.slug, p.title_en
       ORDER BY SUM(a.cost) DESC, SUM(a.conversions) DESC, a.product_id
       LIMIT 15`
    )
      .bind(...binds)
      .all();

    const fresh: any = await env.DB.prepare(`SELECT * FROM analysis_google_ads_freshness`).first();
    const latestReportDate = fresh?.latest_report_date || null;
    const anchorDate = f.end || latestReportDate || null;

    let trend: any = {
      anchor_date: anchorDate,
      current_start: null,
      previous_start: null,
      previous_end: null,
      cost_28d: 0,
      clicks_28d: 0,
      impressions_28d: 0,
      conversions_28d: 0,
      conversion_value_28d: 0,
      cpa_28d: null,
      roas_28d: null,
      cost_prev_28d: 0,
      clicks_prev_28d: 0,
      impressions_prev_28d: 0,
      conversions_prev_28d: 0,
      conversion_value_prev_28d: 0,
      cpa_prev_28d: null,
      roas_prev_28d: null,
      cost_growth_pct: null,
      conversions_growth_pct: null,
      conversion_value_growth_pct: null,
    };

    if (anchorDate) {
      const currentStart = shiftIsoDate(anchorDate, -27);
      const previousEnd = shiftIsoDate(anchorDate, -28);
      const previousStart = shiftIsoDate(anchorDate, -55);
      if (currentStart && previousEnd && previousStart) {
        let productTrendSql = "";
        const curBinds: any[] = [currentStart, anchorDate];
        const prevBinds: any[] = [previousStart, previousEnd];
        if (f.productId !== null) {
          productTrendSql = " AND a.product_id = ?";
          curBinds.push(f.productId);
          prevBinds.push(f.productId);
        }

        const cur: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(a.cost), 0) AS cost,
             COALESCE(SUM(a.clicks), 0) AS clicks,
             COALESCE(SUM(a.impressions), 0) AS impressions,
             COALESCE(SUM(a.conversions), 0) AS conversions,
             COALESCE(SUM(a.conversion_value), 0) AS conversion_value
           FROM google_ads_campaign_daily a
           WHERE a.report_date >= ? AND a.report_date <= ?${productTrendSql}`
        )
          .bind(...curBinds)
          .first();

        const prev: any = await env.DB.prepare(
          `SELECT
             COALESCE(SUM(a.cost), 0) AS cost,
             COALESCE(SUM(a.clicks), 0) AS clicks,
             COALESCE(SUM(a.impressions), 0) AS impressions,
             COALESCE(SUM(a.conversions), 0) AS conversions,
             COALESCE(SUM(a.conversion_value), 0) AS conversion_value
           FROM google_ads_campaign_daily a
           WHERE a.report_date >= ? AND a.report_date <= ?${productTrendSql}`
        )
          .bind(...prevBinds)
          .first();

        const prevCost = Number(prev?.cost || 0);
        const prevConversions = Number(prev?.conversions || 0);
        const prevConversionValue = Number(prev?.conversion_value || 0);
        const curCost = Number(cur?.cost || 0);
        const curConversions = Number(cur?.conversions || 0);
        const curConversionValue = Number(cur?.conversion_value || 0);

        trend = {
          anchor_date: anchorDate,
          current_start: currentStart,
          previous_start: previousStart,
          previous_end: previousEnd,
          cost_28d: curCost,
          clicks_28d: Number(cur?.clicks || 0),
          impressions_28d: Number(cur?.impressions || 0),
          conversions_28d: curConversions,
          conversion_value_28d: curConversionValue,
          cpa_28d: curConversions > 0 ? Math.round((curCost / curConversions) * 100) / 100 : null,
          roas_28d: curCost > 0 ? Math.round((curConversionValue / curCost) * 100) / 100 : null,
          cost_prev_28d: prevCost,
          clicks_prev_28d: Number(prev?.clicks || 0),
          impressions_prev_28d: Number(prev?.impressions || 0),
          conversions_prev_28d: prevConversions,
          conversion_value_prev_28d: prevConversionValue,
          cpa_prev_28d: prevConversions > 0 ? Math.round((prevCost / prevConversions) * 100) / 100 : null,
          roas_prev_28d: prevCost > 0 ? Math.round((prevConversionValue / prevCost) * 100) / 100 : null,
          cost_growth_pct: prevCost > 0 ? Math.round(((curCost - prevCost) * 10000) / prevCost) / 100 : null,
          conversions_growth_pct:
            prevConversions > 0 ? Math.round(((curConversions - prevConversions) * 10000) / prevConversions) / 100 : null,
          conversion_value_growth_pct:
            prevConversionValue > 0
              ? Math.round(((curConversionValue - prevConversionValue) * 10000) / prevConversionValue) / 100
              : null,
        };
      }
    }

    const rowsTotal = Number(fresh?.total_rows || 0);
    const googleAdsDays =
      fresh?.days_since_latest_report === null || fresh?.days_since_latest_report === undefined
        ? null
        : Number(fresh.days_since_latest_report);
    const latestSyncStatus = String(fresh?.last_sync_status || "").toLowerCase() || null;
    let freshnessStatus: "ok" | "warning" | "empty" = "empty";
    if (rowsTotal > 0) {
      freshnessStatus = "ok";
      if (googleAdsDays !== null && googleAdsDays > 4) freshnessStatus = "warning";
      if (latestSyncStatus && ["failed", "partial", "error"].includes(latestSyncStatus)) freshnessStatus = "warning";
    }

    return json({
      success: true,
      available: true,
      filters: { start: f.start, end: f.end, product_id: f.productId },
      summary: {
        campaigns: Number(summary?.campaigns || 0),
        ad_groups: Number(summary?.ad_groups || 0),
        impressions: Number(summary?.impressions || 0),
        clicks: Number(summary?.clicks || 0),
        cost: Number(summary?.cost || 0),
        conversions: Number(summary?.conversions || 0),
        conversion_value: Number(summary?.conversion_value || 0),
        all_conversions: Number(summary?.all_conversions || 0),
        all_conversions_value: Number(summary?.all_conversions_value || 0),
        ctr_pct: summary?.ctr_pct === null || summary?.ctr_pct === undefined ? null : Number(summary.ctr_pct),
        cpc: summary?.cpc === null || summary?.cpc === undefined ? null : Number(summary.cpc),
        cpa: summary?.cpa === null || summary?.cpa === undefined ? null : Number(summary.cpa),
        roas: summary?.roas === null || summary?.roas === undefined ? null : Number(summary.roas),
        mapped_cost: Number(summary?.mapped_cost || 0),
      },
      trend_28d: trend,
      freshness: {
        total_rows: rowsTotal,
        latest_report_date: latestReportDate,
        days_since_latest_report: googleAdsDays,
        last_success_sync_at: fresh?.last_success_sync_at || null,
        last_sync_at: fresh?.last_sync_at || null,
        last_sync_status: latestSyncStatus,
        sync_errors_7d: Number(fresh?.sync_errors_7d || 0),
        status: freshnessStatus,
        caveat:
          "Google Ads conversion value is platform-attributed and directional only; keep separate from canonical D1 order revenue.",
      },
      top_campaigns: topCampaigns.results || [],
      top_products: topProducts.results || [],
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (
      msg.includes("no such table: google_ads_campaign_daily") ||
      msg.includes("no such table: analysis_google_ads_freshness")
    ) {
      return json({
        success: true,
        available: false,
        message: "Google Ads schema is not available in this environment yet. Apply migration 050_google_ads_analytics.sql.",
        filters: { start: f.start, end: f.end, product_id: f.productId },
      });
    }
    return err("GOOGLE_ADS_QUERY_FAILED", msg, 500);
  }
}

// ── Growth signals (Phase 13) ────────────────────────────────────────────
// Signal-only layer. No opportunity scoring/ranking is computed here.
// Phase 14 remains the owner of model weights, scoring, and recommendations.

async function getGrowthSignals(env: any, f: Filters): Promise<Response> {
  const now = new Date().toISOString().slice(0, 10);
  const anchorDate = f.end || now;
  const currentStart = shiftIsoDate(anchorDate, -27) || anchorDate;
  const previousEnd = shiftIsoDate(anchorDate, -28) || anchorDate;
  const previousStart = shiftIsoDate(anchorDate, -55) || anchorDate;

  const pct = (num: any, den: any): number | null => {
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
    return Math.round((n / d) * 1000) / 10;
  };

  const n = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);
  const days = (v: any): number | null => (v === null || v === undefined ? null : Number(v));
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const firstOrNull = async (sql: string, binds: any[] = []): Promise<any | null> => {
    try {
      return await env.DB.prepare(sql).bind(...binds).first();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("no such table") || msg.includes("no such view")) return null;
      throw e;
    }
  };

  const allOrNull = async (sql: string, binds: any[] = []): Promise<any[] | null> => {
    try {
      const out = await env.DB.prepare(sql).bind(...binds).all();
      return out.results || [];
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (msg.includes("no such table") || msg.includes("no such view")) return null;
      throw e;
    }
  };

  // Optional filters that are valid for sales-based sources.
  const productSql = f.productId !== null ? " AND product_id = ?" : "";
  const productBind = f.productId !== null ? [f.productId] : [];
  const salesChannelSql = f.channel ? " AND channel_norm = ?" : "";
  const salesChannelBind = f.channel ? [f.channel] : [];

  // GA4 (website scope) demand + conversion inputs.
  const ga4Cur = await firstOrNull(
    `SELECT
       COALESCE(SUM(sessions), 0) AS sessions,
       COALESCE(SUM(add_to_cart), 0) AS add_to_cart,
       COALESCE(SUM(begin_checkout), 0) AS begin_checkout,
       COALESCE(SUM(purchases), 0) AS purchases
     FROM ga4_funnel_daily
     WHERE property_scope = 'website'
       AND report_date >= ? AND report_date <= ?${productSql}`,
    [currentStart, anchorDate, ...productBind]
  );
  const ga4Prev = await firstOrNull(
    `SELECT COALESCE(SUM(sessions), 0) AS sessions
     FROM ga4_funnel_daily
     WHERE property_scope = 'website'
       AND report_date >= ? AND report_date <= ?${productSql}`,
    [previousStart, previousEnd, ...productBind]
  );
  const ga4Cov = await firstOrNull(
    `SELECT
       COALESCE(SUM(sessions), 0) AS total_sessions,
       COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN sessions ELSE 0 END), 0) AS mapped_sessions
     FROM ga4_funnel_daily
     WHERE property_scope = 'website'
       AND report_date >= ? AND report_date <= ?`,
    [currentStart, anchorDate]
  );
  const ga4Fresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_ga4_freshness");

  // GSC demand inputs.
  const gscCur = await firstOrNull(
    `SELECT COALESCE(SUM(clicks), 0) AS clicks
     FROM gsc_search_daily
     WHERE report_date >= ? AND report_date <= ?${productSql}`,
    [currentStart, anchorDate, ...productBind]
  );
  const gscPrev = await firstOrNull(
    `SELECT COALESCE(SUM(clicks), 0) AS clicks
     FROM gsc_search_daily
     WHERE report_date >= ? AND report_date <= ?${productSql}`,
    [previousStart, previousEnd, ...productBind]
  );
  const gscCov = await firstOrNull(
    `SELECT
       COALESCE(SUM(clicks), 0) AS total_clicks,
       COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN clicks ELSE 0 END), 0) AS mapped_clicks
     FROM gsc_search_daily
     WHERE report_date >= ? AND report_date <= ?`,
    [currentStart, anchorDate]
  );
  const gscFresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_gsc_freshness");

  // Etsy demand inputs (listing-id based; mapped by master table).
  const etsyProductSql = f.productId !== null ? " AND m.product_id = ?" : "";
  const etsyCur = await firstOrNull(
    `SELECT
       COALESCE(SUM(e.views), 0) AS views,
       COALESCE(SUM(e.orders), 0) AS orders,
       COALESCE(SUM(CASE WHEN m.product_id IS NOT NULL THEN e.views ELSE 0 END), 0) AS mapped_views
     FROM etsy_listing_daily e
     LEFT JOIN etsy_listing_master m ON m.listing_id = e.listing_id
     WHERE e.report_date >= ? AND e.report_date <= ?${etsyProductSql}`,
    [currentStart, anchorDate, ...(f.productId !== null ? [f.productId] : [])]
  );
  const etsyPrev = await firstOrNull(
    `SELECT COALESCE(SUM(e.views), 0) AS views
     FROM etsy_listing_daily e
     LEFT JOIN etsy_listing_master m ON m.listing_id = e.listing_id
     WHERE e.report_date >= ? AND e.report_date <= ?${etsyProductSql}`,
    [previousStart, previousEnd, ...(f.productId !== null ? [f.productId] : [])]
  );
  const etsyCov = await firstOrNull(
    `SELECT
       COALESCE(SUM(e.views), 0) AS total_views,
       COALESCE(SUM(CASE WHEN m.product_id IS NOT NULL THEN e.views ELSE 0 END), 0) AS mapped_views
     FROM etsy_listing_daily e
     LEFT JOIN etsy_listing_master m ON m.listing_id = e.listing_id
     WHERE e.report_date >= ? AND e.report_date <= ?`,
    [currentStart, anchorDate]
  );
  const etsyFresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_etsy_freshness");

  // Google Ads metadata only for Phase 13 (neutral if sparse/zero signal).
  const adsCur = await firstOrNull(
    `SELECT
       COUNT(*) AS rows_n,
       COALESCE(SUM(cost), 0) AS cost,
       COALESCE(SUM(conversions), 0) AS conversions,
       COALESCE(SUM(CASE WHEN product_id IS NOT NULL THEN cost ELSE 0 END), 0) AS mapped_cost
     FROM google_ads_campaign_daily
     WHERE report_date >= ? AND report_date <= ?${productSql}`,
    [currentStart, anchorDate, ...productBind]
  );
  const adsFresh = await firstOrNull("SELECT latest_report_date, days_since_latest_report, total_rows FROM analysis_google_ads_freshness");

  // Sales-based momentum + channel context.
  const salesCur = await firstOrNull(
    `SELECT
       COUNT(DISTINCT sales_order_id) AS orders,
       COALESCE(SUM(quantity), 0) AS units
     FROM analysis_active_items
     WHERE order_day >= ? AND order_day <= ?${productSql}${salesChannelSql}`,
    [currentStart, anchorDate, ...productBind, ...salesChannelBind]
  );
  const salesPrev = await firstOrNull(
    `SELECT
       COUNT(DISTINCT sales_order_id) AS orders,
       COALESCE(SUM(quantity), 0) AS units
     FROM analysis_active_items
     WHERE order_day >= ? AND order_day <= ?${productSql}${salesChannelSql}`,
    [previousStart, previousEnd, ...productBind, ...salesChannelBind]
  );
  const channelRows = await allOrNull(
    `SELECT channel_norm, COUNT(DISTINCT sales_order_id) AS orders, COALESCE(SUM(quantity), 0) AS units
     FROM analysis_active_items
     WHERE order_day >= ? AND order_day <= ?${productSql}${salesChannelSql}
     GROUP BY channel_norm
     ORDER BY units DESC, orders DESC`,
    [currentStart, anchorDate, ...productBind, ...salesChannelBind]
  );
  const orderCov = await firstOrNull(
    `SELECT COALESCE(SUM(mapped_orders), 0) AS mapped_orders, COALESCE(SUM(orders), 0) AS orders
     FROM analysis_sales_daily
     WHERE order_day >= ? AND order_day <= ?${f.channel ? " AND channel_norm = ?" : ""}`,
    [currentStart, anchorDate, ...(f.channel ? [f.channel] : [])]
  );

  // Secondary profitability guardrail coverage (no ranking ownership here).
  const profitCov = await firstOrNull("SELECT * FROM analysis_profit_coverage");

  const ga4Sessions = n(ga4Cur?.sessions);
  const ga4PrevSessions = n(ga4Prev?.sessions);
  const gscClicks = n(gscCur?.clicks);
  const gscPrevClicks = n(gscPrev?.clicks);
  const etsyViews = n(etsyCur?.views);
  const etsyPrevViews = n(etsyPrev?.views);

  const ga4MappedPct = pct(ga4Cov?.mapped_sessions, ga4Cov?.total_sessions);
  const gscMappedPct = pct(gscCov?.mapped_clicks, gscCov?.total_clicks);
  const etsyMappedPct = pct(etsyCov?.mapped_views, etsyCov?.total_views);
  const adsMappedPct = pct(adsCur?.mapped_cost, adsCur?.cost);
  const orderMappedPct = pct(orderCov?.mapped_orders, orderCov?.orders);

  const ga4Days = days(ga4Fresh?.days_since_latest_report);
  const gscDays = days(gscFresh?.days_since_latest_report);
  const etsyDays = days(etsyFresh?.days_since_latest_report);
  const adsDays = days(adsFresh?.days_since_latest_report);

  const signals: any = {};
  const impacts: number[] = [];

  // Demand
  const ga4Growth = ga4PrevSessions > 0 ? Math.round(((ga4Sessions - ga4PrevSessions) * 1000) / ga4PrevSessions) / 10 : null;
  const gscGrowth = gscPrevClicks > 0 ? Math.round(((gscClicks - gscPrevClicks) * 1000) / gscPrevClicks) / 10 : null;
  const etsyGrowth = etsyPrevViews > 0 ? Math.round(((etsyViews - etsyPrevViews) * 1000) / etsyPrevViews) / 10 : null;
  const growthPool = [ga4Growth, gscGrowth, etsyGrowth].filter((v) => v !== null) as number[];
  const blendedGrowth = growthPool.length ? Math.round((growthPool.reduce((s, v) => s + v, 0) / growthPool.length) * 10) / 10 : null;

  let demandStatus = "sufficient";
  let demandImpact = 0;
  const staleDemandSources: string[] = [];
  if (ga4Sessions > 0 && ga4Days !== null && ga4Days > 10) staleDemandSources.push("ga4");
  if (gscClicks > 0 && gscDays !== null && gscDays > 14) staleDemandSources.push("gsc");
  if (etsyViews > 0 && etsyDays !== null && etsyDays > 7) staleDemandSources.push("etsy");
  const hasDemandSignal = ga4Sessions > 0 || gscClicks > 0 || etsyViews > 0;
  if (!hasDemandSignal) {
    demandStatus = "insufficient_signal";
    demandImpact -= 25;
  } else if (staleDemandSources.length) {
    demandStatus = "stale_source";
    demandImpact -= 10;
  } else if (
    (ga4MappedPct !== null && ga4MappedPct < 50) ||
    (gscMappedPct !== null && gscMappedPct < 50) ||
    (etsyMappedPct !== null && etsyMappedPct < 50)
  ) {
    demandStatus = "mapping_gap";
    demandImpact -= 10;
  }
  impacts.push(demandImpact);
  signals.demand = {
    value: {
      ga4_sessions_28d: ga4Sessions,
      gsc_clicks_28d: gscClicks,
      etsy_views_28d: etsyViews,
      blended_growth_pct: blendedGrowth,
      ga4_growth_pct: ga4Growth,
      gsc_growth_pct: gscGrowth,
      etsy_growth_pct: etsyGrowth,
    },
    status: demandStatus,
    coverage: {
      ga4_mapped_session_pct: ga4MappedPct,
      gsc_mapped_click_pct: gscMappedPct,
      etsy_mapped_view_pct: etsyMappedPct,
    },
    freshness_days: { ga4: ga4Days, gsc: gscDays, etsy: etsyDays },
    confidence_impact: demandImpact,
    reason: !hasDemandSignal
      ? "No measurable 28-day demand signal from GA4 website scope, GSC, or Etsy in the selected window."
      : staleDemandSources.length
        ? `Demand sources stale: ${staleDemandSources.join(", ")}.`
        : demandStatus === "mapping_gap"
          ? "Demand exists but mapped coverage is thin for at least one active source."
          : "Demand signal is present and mapped coverage/freshness are acceptable.",
  };

  // Momentum
  const curUnits = n(salesCur?.units);
  const prevUnits = n(salesPrev?.units);
  const curOrders = n(salesCur?.orders);
  const prevOrders = n(salesPrev?.orders);
  const unitGrowthPct = prevUnits > 0 ? Math.round(((curUnits - prevUnits) * 1000) / prevUnits) / 10 : null;
  let momentumStatus = "sufficient";
  let momentumImpact = 0;
  if (curUnits + prevUnits <= 0) {
    momentumStatus = "insufficient_signal";
    momentumImpact -= 20;
  } else if (prevUnits <= 0 && curUnits > 0) {
    momentumStatus = "insufficient_signal";
    momentumImpact -= 8;
  }
  impacts.push(momentumImpact);
  signals.momentum = {
    value: {
      units_28d: curUnits,
      units_prev_28d: prevUnits,
      orders_28d: curOrders,
      orders_prev_28d: prevOrders,
      units_growth_pct: unitGrowthPct,
    },
    status: momentumStatus,
    coverage: {
      mapped_order_pct: orderMappedPct,
      window_start: currentStart,
      window_end: anchorDate,
    },
    freshness_days: null,
    confidence_impact: momentumImpact,
    reason:
      curUnits + prevUnits <= 0
        ? "No unit activity in current and previous windows."
        : prevUnits <= 0
          ? "Current activity exists but previous baseline is zero, so growth direction is weakly anchored."
          : "Momentum uses comparable 28-day windows over mapped active items.",
  };

  // Conversion availability (availability only, not decision score logic).
  const ga4Atc = n(ga4Cur?.add_to_cart);
  const ga4Checkout = n(ga4Cur?.begin_checkout);
  const ga4Purchases = n(ga4Cur?.purchases);
  const ga4PurchaseRate = ga4Sessions > 0 ? Math.round((ga4Purchases * 1000) / ga4Sessions) / 10 : null;
  let conversionStatus = "sufficient";
  let conversionImpact = 0;
  if (ga4Sessions <= 0) {
    conversionStatus = "insufficient_signal";
    conversionImpact -= 15;
  } else if (ga4Atc + ga4Checkout + ga4Purchases <= 0) {
    conversionStatus = "insufficient_signal";
    conversionImpact -= 10;
  } else if (ga4MappedPct !== null && ga4MappedPct < 50) {
    conversionStatus = "mapping_gap";
    conversionImpact -= 5;
  }
  impacts.push(conversionImpact);
  signals.conversion_availability = {
    value: {
      sessions_28d: ga4Sessions,
      add_to_cart_28d: ga4Atc,
      begin_checkout_28d: ga4Checkout,
      purchases_28d: ga4Purchases,
      purchase_rate_pct: ga4PurchaseRate,
    },
    status: conversionStatus,
    coverage: { ga4_mapped_session_pct: ga4MappedPct },
    freshness_days: ga4Days,
    confidence_impact: conversionImpact,
    reason:
      ga4Sessions <= 0
        ? "No GA4 website sessions in the selected window."
        : ga4Atc + ga4Checkout + ga4Purchases <= 0
          ? "GA4 traffic exists but funnel events are sparse/absent."
          : conversionStatus === "mapping_gap"
            ? "Conversion events exist but product mapping coverage is limited."
            : "GA4 funnel events are available for growth diagnostics.",
  };

  // Channel context
  const channels = channelRows || [];
  const totalChannelUnits = channels.reduce((s: number, r: any) => s + n(r.units), 0);
  const topChannel = channels.length ? String(channels[0].channel_norm || "") : null;
  const topChannelShare = totalChannelUnits > 0 ? Math.round((n(channels[0]?.units) * 1000) / totalChannelUnits) / 10 : null;
  let channelStatus = "sufficient";
  let channelImpact = 0;
  if (!channels.length) {
    channelStatus = "insufficient_signal";
    channelImpact -= 10;
  } else if (channels.length === 1) {
    channelStatus = "neutral";
    channelImpact -= 3;
  }
  impacts.push(channelImpact);
  signals.channel_context = {
    value: {
      active_channels_28d: channels.length,
      top_channel: topChannel,
      top_channel_units_share_pct: topChannelShare,
      channel_rows: channels.slice(0, 6),
    },
    status: channelStatus,
    coverage: { channel_filter: f.channel || null },
    freshness_days: null,
    confidence_impact: channelImpact,
    reason:
      !channels.length
        ? "No channel-level unit activity in the selected window."
        : channels.length === 1
          ? "Activity is concentrated in one channel; breadth signal is limited."
          : "Multiple channels are active, enabling channel-opportunity comparisons.",
  };

  // Source freshness (cross-source observability).
  const hasGa4Data = n(ga4Fresh?.total_rows) > 0 || ga4Sessions > 0;
  const hasGscData = n(gscFresh?.total_rows) > 0 || gscClicks > 0;
  const hasEtsyData = n(etsyFresh?.total_rows) > 0 || etsyViews > 0;
  const hasAdsData = n(adsFresh?.total_rows) > 0 || n(adsCur?.rows_n) > 0 || n(adsCur?.cost) > 0;
  const staleSources: string[] = [];
  if (hasGa4Data && ga4Days !== null && ga4Days > 10) staleSources.push("ga4");
  if (hasGscData && gscDays !== null && gscDays > 14) staleSources.push("gsc");
  if (hasEtsyData && etsyDays !== null && etsyDays > 7) staleSources.push("etsy");
  if (hasAdsData && adsDays !== null && adsDays > 4) staleSources.push("google_ads");
  let freshnessStatus = "sufficient";
  let freshnessImpact = 0;
  if (!hasGa4Data && !hasGscData && !hasEtsyData) {
    freshnessStatus = "insufficient_signal";
    freshnessImpact -= 20;
  } else if (staleSources.length) {
    freshnessStatus = "stale_source";
    freshnessImpact -= 10;
  }
  impacts.push(freshnessImpact);
  const adsNeutral = !hasAdsData || n(adsCur?.cost) <= 0 || n(adsCur?.conversions) <= 0;
  signals.source_freshness = {
    value: {
      ga4_days_since_latest: ga4Days,
      gsc_days_since_latest: gscDays,
      etsy_days_since_latest: etsyDays,
      google_ads_days_since_latest: adsDays,
    },
    status: freshnessStatus,
    coverage: {
      ga4_available: hasGa4Data,
      gsc_available: hasGscData,
      etsy_available: hasEtsyData,
      google_ads_available: hasAdsData,
    },
    freshness_days: { ga4: ga4Days, gsc: gscDays, etsy: etsyDays, google_ads: adsDays },
    confidence_impact: freshnessImpact,
    reason: !hasGa4Data && !hasGscData && !hasEtsyData
      ? "Primary growth sources have no reported data rows yet."
      : staleSources.length
        ? `Source freshness warning: ${staleSources.join(", ")}.`
        : adsNeutral
          ? "Primary growth sources are fresh. Google Ads is operational but currently treated as neutral due to sparse/zero business signal."
          : "Primary growth sources are fresh.",
  };

  // Mapping coverage (cross-source).
  const coveragePool = [ga4MappedPct, gscMappedPct, etsyMappedPct].filter((v) => v !== null) as number[];
  const mappedAvg = coveragePool.length ? Math.round((coveragePool.reduce((s, v) => s + v, 0) / coveragePool.length) * 10) / 10 : null;
  let mappingStatus = "sufficient";
  let mappingImpact = 0;
  if (!coveragePool.length) {
    mappingStatus = "insufficient_signal";
    mappingImpact -= 15;
  } else if (mappedAvg !== null && mappedAvg < 50) {
    mappingStatus = "mapping_gap";
    mappingImpact -= 15;
  } else if (mappedAvg !== null && mappedAvg < 75) {
    mappingStatus = "mapping_gap";
    mappingImpact -= 8;
  }
  impacts.push(mappingImpact);
  signals.mapping_coverage = {
    value: { mapped_avg_pct: mappedAvg, order_mapped_pct_28d: orderMappedPct },
    status: mappingStatus,
    coverage: {
      ga4_mapped_session_pct: ga4MappedPct,
      gsc_mapped_click_pct: gscMappedPct,
      etsy_mapped_view_pct: etsyMappedPct,
      google_ads_mapped_cost_pct: adsMappedPct,
    },
    freshness_days: null,
    confidence_impact: mappingImpact,
    reason:
      !coveragePool.length
        ? "No mapped coverage baseline available from active growth sources in the current window."
        : mappingStatus === "mapping_gap"
          ? "Mapped coverage is below target for at least one growth source."
          : "Mapped coverage is healthy for active growth sources.",
  };

  // Profitability guardrail (secondary only).
  const grossCovPct = pct(profitCov?.gross_covered_revenue, profitCov?.total_revenue);
  const contribCovPct = pct(profitCov?.contribution_covered_revenue, profitCov?.total_revenue);
  const fullCostOrderPct = pct(profitCov?.full_cost_orders, profitCov?.commercial_orders);
  let guardrailImpact = 0;
  let guardrailStatus = "secondary_guardrail";
  if (grossCovPct !== null && grossCovPct < 50) guardrailImpact -= 5;
  impacts.push(guardrailImpact);
  if (!profitCov) guardrailStatus = "insufficient_signal";
  signals.profitability_guardrail = {
    value: {
      gross_covered_revenue_pct: grossCovPct,
      contribution_covered_revenue_pct: contribCovPct,
      full_cost_order_pct: fullCostOrderPct,
      products_with_cost: profitCov ? n(profitCov.products_with_cost) : null,
      active_products: profitCov ? n(profitCov.active_products) : null,
    },
    status: guardrailStatus,
    coverage: profitCov
      ? {
          products_with_cost: n(profitCov.products_with_cost),
          active_products: n(profitCov.active_products),
          channels_with_fees: n(profitCov.channels_with_fees),
          channels_with_shipping: n(profitCov.channels_with_shipping),
        }
      : null,
    freshness_days: null,
    confidence_impact: guardrailImpact,
    reason: !profitCov
      ? "Profitability coverage view unavailable in this environment."
      : "Profitability is a secondary guardrail in Phase 13 and does not control opportunity ranking here.",
  };

  // Final confidence (metadata only).
  const confidenceValue = clamp(Math.round((100 + impacts.reduce((s, v) => s + v, 0)) * 10) / 10, 0, 100);
  signals.confidence = {
    value: confidenceValue,
    status: confidenceValue >= 75 ? "sufficient" : confidenceValue >= 50 ? "neutral" : "insufficient_signal",
    coverage: {
      signal_count: 7,
      total_impact: impacts.reduce((s, v) => s + v, 0),
    },
    freshness_days: null,
    confidence_impact: 0,
    reason:
      "Confidence summarizes signal quality/coverage and source freshness; missing or immature sources reduce confidence without forcing synthetic zero values.",
  };

  return json({
    success: true,
    growth_signal_contract: "v1",
    objective:
      "Build a sales-growth analytical layer that identifies demand, momentum, conversion, and channel opportunities across MildMate products and listings, while using profitability as a secondary guardrail.",
    filters: { start: f.start, end: f.end, channel: f.channel, product_id: f.productId },
    window: {
      anchor_date: anchorDate,
      current_start: currentStart,
      current_end: anchorDate,
      previous_start: previousStart,
      previous_end: previousEnd,
    },
    google_ads_policy: {
      infrastructure: "available",
      business_signal: adsNeutral ? "insufficient_or_sparse" : "present",
      scoring_effect: "neutral_in_phase13",
      reason:
        "Phase 13 treats Google Ads sparse/zero business signal as neutral and surfaces it via coverage/freshness/confidence metadata.",
    },
    signals,
  });
}

async function getDataQuality(env: any): Promise<Response> {
  const dq: any = await env.DB.prepare(`SELECT * FROM analysis_data_quality`).first();
  if (!dq) return err("DATA_QUALITY_UNAVAILABLE", "analysis_data_quality returned no row.", 500);

  // Phase 06 additions computed live (the 042 view is frozen; no migration needed for counts)
  const zeroRow: any = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM analysis_commercial_orders WHERE order_total IS NULL OR order_total <= 0`
  ).first();
  const zeroTotalOrders = Number(zeroRow?.n || 0);

  const runs = await env.DB.prepare(
    `SELECT id, source, scenario, started_at, finished_at, status,
            records_received, records_created, records_updated, records_unchanged, records_rejected,
            substr(COALESCE(error_message, ''), 1, 300) AS error_message
     FROM sync_runs
     ORDER BY COALESCE(finished_at, created_at) DESC
     LIMIT 10`
  ).all();

  const freshness = await env.DB.prepare(
    `SELECT channel_norm,
            MAX(order_day) AS last_order_day,
            COUNT(*) AS orders,
            CAST(julianday('now') - julianday(MAX(order_day)) AS INTEGER) AS days_since_last_order
     FROM analysis_commercial_orders
     GROUP BY channel_norm
     ORDER BY last_order_day DESC`
  ).all();

  // Phase 08 addition: historical coverage (the 042 view is frozen; computed live)
  const spanRow: any = await env.DB.prepare(
    `SELECT MIN(order_day) AS first_order_day,
            MAX(order_day) AS last_order_day,
            COUNT(*) AS total_orders,
            COUNT(DISTINCT channel_norm) AS channels
     FROM analysis_commercial_orders`
  ).first();

  const coverageYear = await env.DB.prepare(
    `SELECT COALESCE(substr(co.order_day, 1, 4), 'unknown') AS year,
            COUNT(*) AS orders,
            COUNT(DISTINCT substr(co.order_day, 1, 7)) AS months_with_orders,
            COUNT(DISTINCT co.channel_norm) AS channels,
            MIN(co.order_day) AS first_day,
            MAX(co.order_day) AS last_day,
            SUM(CASE WHEN om.derived_mapping_status = 'Mapped' THEN 1 ELSE 0 END) AS mapped_orders
     FROM analysis_commercial_orders co
     LEFT JOIN analysis_order_mapping om ON om.sales_order_id = co.id
     GROUP BY COALESCE(substr(co.order_day, 1, 4), 'unknown')
     ORDER BY year`
  ).all();

  const coverageChannel = await env.DB.prepare(
    `SELECT co.channel_norm,
            COUNT(*) AS orders,
            MIN(co.order_day) AS first_day,
            MAX(co.order_day) AS last_day,
            SUM(CASE WHEN om.derived_mapping_status = 'Mapped' THEN 1 ELSE 0 END) AS mapped_orders
     FROM analysis_commercial_orders co
     LEFT JOIN analysis_order_mapping om ON om.sales_order_id = co.id
     GROUP BY co.channel_norm
     ORDER BY orders DESC, co.channel_norm`
  ).all();

  let gscFreshness: any = null;
  try {
    gscFreshness = await env.DB.prepare(`SELECT * FROM analysis_gsc_freshness`).first();
  } catch {
    // Migration 046 may not exist yet in a given environment.
    gscFreshness = null;
  }

  let ga4Freshness: any = null;
  try {
    ga4Freshness = await env.DB.prepare(`SELECT * FROM analysis_ga4_freshness`).first();
  } catch {
    // Migration 048 may not exist yet in a given environment.
    ga4Freshness = null;
  }

  let etsyFreshness: any = null;
  try {
    etsyFreshness = await env.DB.prepare(`SELECT * FROM analysis_etsy_freshness`).first();
  } catch {
    // Migration 049 may not exist yet in a given environment.
    etsyFreshness = null;
  }

  let googleAdsFreshness: any = null;
  try {
    googleAdsFreshness = await env.DB.prepare(`SELECT * FROM analysis_google_ads_freshness`).first();
  } catch {
    // Migration 050 may not exist yet in a given environment.
    googleAdsFreshness = null;
  }

  // M22 freshness + M30 roll-up (contract: computed in code, not SQL)
  let freshnessMinutes: number | null = null;
  const rawTs = String(dq.last_success_sync_at || "").trim();
  if (rawTs) {
    let d = new Date(rawTs);
    if (isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(rawTs)) {
      d = new Date(rawTs.replace(" ", "T") + "Z");
    }
    if (!isNaN(d.getTime())) {
      freshnessMinutes = Math.round((Date.now() - d.getTime()) / 60000);
    }
  }

  const warnings: string[] = [];
  let level: "ok" | "warning" | "critical" = "ok";
  const lastStatus = String(dq.last_sync_status || "").toLowerCase();

  if (!rawTs) { level = "critical"; warnings.push("No successful sales sync recorded."); }
  if (["failed", "partial", "error"].includes(lastStatus)) { level = "critical"; warnings.push("Latest sync run status: " + lastStatus + "."); }
  if (Number(dq.invalid_product_refs || 0) > 0) { level = "critical"; warnings.push(dq.invalid_product_refs + " item(s) reference a non-existent product id."); }

  const warn = (msg: string) => { if (level !== "critical") level = "warning"; warnings.push(msg); };
  if (freshnessMinutes !== null && freshnessMinutes > 30) warn("Last successful sync was " + freshnessMinutes + " minutes ago (threshold 30).");
  if (Number(dq.sync_errors_7d || 0) > 0) warn(dq.sync_errors_7d + " sync error(s) in the last 7 days.");
  if (Number(dq.missing_product_id_items || 0) > 0) warn(dq.missing_product_id_items + " active item(s) have no Product_ID.");
  if (Number(dq.itemless_orders || 0) > 0) warn(dq.itemless_orders + " commercial order(s) have no items.");
  if (Number(dq.orders_missing_date || 0) > 0) warn(dq.orders_missing_date + " commercial order(s) have a missing/malformed order date.");
  if (Number(dq.unknown_status_orders || 0) > 0) warn(dq.unknown_status_orders + " order(s) have an unknown status value.");
  if (Number(dq.unknown_source_labels || 0) > 0) warn(dq.unknown_source_labels + " unknown source label(s) present.");
  if (zeroTotalOrders > 0) warn(zeroTotalOrders + " commercial order(s) have a null/zero order total (business rules require a positive total).");

  const gscRows = Number(gscFreshness?.total_rows || 0);
  const gscDays = gscFreshness?.days_since_latest_report === null || gscFreshness?.days_since_latest_report === undefined
    ? null
    : Number(gscFreshness.days_since_latest_report);
  const gscLastStatus = String(gscFreshness?.last_sync_status || "").toLowerCase();
  if (gscRows > 0) {
    if (gscDays !== null && gscDays > 4) warn("GSC freshness is " + gscDays + " days old (threshold 4).");
    if (["failed", "partial", "error"].includes(gscLastStatus)) warn("Latest GSC sync run status: " + gscLastStatus + ".");
  }

  const ga4Rows = Number(ga4Freshness?.total_rows || 0);
  const ga4Days =
    ga4Freshness?.days_since_latest_report === null || ga4Freshness?.days_since_latest_report === undefined
      ? null
      : Number(ga4Freshness.days_since_latest_report);
  const ga4LastStatus = String(ga4Freshness?.last_sync_status || "").toLowerCase();
  if (ga4Rows > 0) {
    if (ga4Days !== null && ga4Days > 3) warn("GA4 freshness is " + ga4Days + " days old (threshold 3).");
    if (["failed", "partial", "error"].includes(ga4LastStatus)) warn("Latest GA4 sync run status: " + ga4LastStatus + ".");
  }

  const etsyRows = Number(etsyFreshness?.total_rows || 0);
  const etsyDays =
    etsyFreshness?.days_since_latest_report === null || etsyFreshness?.days_since_latest_report === undefined
      ? null
      : Number(etsyFreshness.days_since_latest_report);
  const etsyLastStatus = String(etsyFreshness?.last_sync_status || "").toLowerCase();
  if (etsyRows > 0) {
    if (etsyDays !== null && etsyDays > 7) warn("Etsy freshness is " + etsyDays + " days old (threshold 7).");
    if (["failed", "partial", "error"].includes(etsyLastStatus)) warn("Latest Etsy sync run status: " + etsyLastStatus + ".");
  }

  const googleAdsRows = Number(googleAdsFreshness?.total_rows || 0);
  const googleAdsDays =
    googleAdsFreshness?.days_since_latest_report === null || googleAdsFreshness?.days_since_latest_report === undefined
      ? null
      : Number(googleAdsFreshness.days_since_latest_report);
  const googleAdsLastStatus = String(googleAdsFreshness?.last_sync_status || "").toLowerCase();
  if (googleAdsRows > 0) {
    if (googleAdsDays !== null && googleAdsDays > 4) {
      warn("Google Ads freshness is " + googleAdsDays + " days old (threshold 4).");
    }
    if (["failed", "partial", "error"].includes(googleAdsLastStatus)) {
      warn("Latest Google Ads sync run status: " + googleAdsLastStatus + ".");
    }
  }

  const commercialOrders = Number(dq.commercial_orders || 0);
  const activeItems = Number(dq.active_items || 0);

  return json({
    success: true,
    data_quality: {
      ...dq,
      freshness_minutes: freshnessMinutes,
      mapped_order_pct: commercialOrders > 0 ? Math.round((Number(dq.mapped_orders || 0) / commercialOrders) * 1000) / 10 : null,
      mapped_item_pct: activeItems > 0 ? Math.round(((activeItems - Number(dq.missing_product_id_items || 0)) / activeItems) * 1000) / 10 : null,
      exact_item_pct: activeItems > 0 ? Math.round((Number(dq.exact_items || 0) / activeItems) * 1000) / 10 : null,
      unallocated_item_pct: activeItems > 0 ? Math.round((Number(dq.unallocated_items || 0) / activeItems) * 1000) / 10 : null,
      zero_total_orders: zeroTotalOrders,
      status: level,
      warnings,
    },
    thresholds: {
      freshness_warning_minutes: 30,
      note: "warning: sync older than 30 min (expected Make.com cadence 15 min); critical: no successful sync, failed last run, or invalid product refs",
    },
    recent_runs: runs.results || [],
    channel_freshness: freshness.results || [],
    gsc_freshness: {
      available: !!gscFreshness,
      total_rows: gscRows,
      latest_report_date: gscFreshness?.latest_report_date || null,
      days_since_latest_report: gscDays,
      last_success_sync_at: gscFreshness?.last_success_sync_at || null,
      last_sync_at: gscFreshness?.last_sync_at || null,
      last_sync_status: gscLastStatus || null,
      sync_errors_7d: Number(gscFreshness?.sync_errors_7d || 0),
      status: gscRows === 0
        ? "empty"
        : ((gscDays !== null && gscDays > 4) || ["failed", "partial", "error"].includes(gscLastStatus) ? "warning" : "ok"),
      caveat: "GSC data is typically delayed by 1–2 days; freshness warning threshold = 4 days.",
    },
    ga4_freshness: {
      available: !!ga4Freshness,
      total_rows: ga4Rows,
      latest_report_date: ga4Freshness?.latest_report_date || null,
      days_since_latest_report: ga4Days,
      last_success_sync_at: ga4Freshness?.last_success_sync_at || null,
      last_sync_at: ga4Freshness?.last_sync_at || null,
      last_sync_status: ga4LastStatus || null,
      sync_errors_7d: Number(ga4Freshness?.sync_errors_7d || 0),
      status: ga4Rows === 0
        ? "empty"
        : ((ga4Days !== null && ga4Days > 3) || ["failed", "partial", "error"].includes(ga4LastStatus) ? "warning" : "ok"),
      caveat: "GA4 event data may finalize with delay; freshness warning threshold = 3 days.",
    },
    etsy_freshness: {
      available: !!etsyFreshness,
      total_rows: etsyRows,
      latest_report_date: etsyFreshness?.latest_report_date || null,
      days_since_latest_report: etsyDays,
      last_success_sync_at: etsyFreshness?.last_success_sync_at || null,
      last_sync_at: etsyFreshness?.last_sync_at || null,
      last_sync_status: etsyLastStatus || null,
      sync_errors_7d: Number(etsyFreshness?.sync_errors_7d || 0),
      total_master_listings: Number(etsyFreshness?.total_master_listings || 0),
      active_master_listings: Number(etsyFreshness?.active_master_listings || 0),
      inactive_master_listings: Number(etsyFreshness?.inactive_master_listings || 0),
      status: etsyRows === 0
        ? "empty"
        : ((etsyDays !== null && etsyDays > 7) || ["failed", "partial", "error"].includes(etsyLastStatus) ? "warning" : "ok"),
      caveat: "Etsy metrics depend on source exports/API windows; freshness warning threshold = 7 days.",
    },
    google_ads_freshness: {
      available: !!googleAdsFreshness,
      total_rows: googleAdsRows,
      latest_report_date: googleAdsFreshness?.latest_report_date || null,
      days_since_latest_report: googleAdsDays,
      last_success_sync_at: googleAdsFreshness?.last_success_sync_at || null,
      last_sync_at: googleAdsFreshness?.last_sync_at || null,
      last_sync_status: googleAdsLastStatus || null,
      sync_errors_7d: Number(googleAdsFreshness?.sync_errors_7d || 0),
      status: googleAdsRows === 0
        ? "empty"
        : ((googleAdsDays !== null && googleAdsDays > 4) || ["failed", "partial", "error"].includes(googleAdsLastStatus) ? "warning" : "ok"),
      caveat:
        "Google Ads conversion value is platform-attributed and directional only; keep separate from canonical D1 order revenue.",
    },
    coverage: {
      first_order_day: spanRow?.first_order_day ?? null,
      last_order_day: spanRow?.last_order_day ?? null,
      total_orders: Number(spanRow?.total_orders || 0),
      channels: Number(spanRow?.channels || 0),
      by_year: coverageYear.results || [],
      by_channel: coverageChannel.results || [],
    },
  });
}

// ── Data-quality exception drill-downs (Phase 06, PII-free) ───────────────

const EXCEPTION_TYPES: Record<string, { sql: string; description: string }> = {
  missing_product_id: {
    description: "Active items on commercial orders without a Product_ID",
    sql: `SELECT ai.order_day, ai.channel_norm, co.source_system, co.source_order_id, co.status,
                 ai.raw_item_text, ai.quantity, ai.revenue_status
          FROM analysis_active_items ai
          JOIN analysis_commercial_orders co ON co.id = ai.sales_order_id
          WHERE ai.product_id IS NULL
          ORDER BY ai.order_day DESC, ai.id`,
  },
  unmapped_orders: {
    description: "Commercial orders where no item has a Product_ID",
    sql: `SELECT co.order_day, co.channel_norm, co.source_system, co.source_order_id, co.status, co.order_total, co.currency
          FROM analysis_commercial_orders co
          JOIN analysis_order_mapping om ON om.sales_order_id = co.id
          WHERE om.derived_mapping_status = 'Unmapped'
          ORDER BY co.order_day DESC, co.id`,
  },
  itemless_orders: {
    description: "Commercial orders with no active items",
    sql: `SELECT co.order_day, co.channel_norm, co.source_system, co.source_order_id, co.status, co.order_total, co.currency
          FROM analysis_commercial_orders co
          JOIN analysis_order_mapping om ON om.sales_order_id = co.id
          WHERE om.derived_mapping_status = 'Itemless'
          ORDER BY co.order_day DESC, co.id`,
  },
  zero_totals: {
    description: "Commercial orders with a null/zero order total",
    sql: `SELECT order_day, channel_norm, source_system, source_order_id, status, order_total, currency
          FROM analysis_commercial_orders
          WHERE order_total IS NULL OR order_total <= 0
          ORDER BY order_day DESC, id`,
  },
  invalid_product_refs: {
    description: "Active items referencing a non-existent product id",
    sql: `SELECT ai.order_day, ai.channel_norm, ai.product_id, co.source_system, co.source_order_id,
                 ai.raw_item_text, ai.quantity
          FROM analysis_active_items ai
          JOIN analysis_commercial_orders co ON co.id = ai.sales_order_id
          LEFT JOIN products p ON p.id = ai.product_id
          WHERE ai.product_id IS NOT NULL AND p.id IS NULL
          ORDER BY ai.order_day DESC, ai.id`,
  },
  unknown_sources: {
    description: "Source labels outside the known channel list",
    sql: `SELECT source_system, COUNT(*) AS orders, MIN(substr(order_date, 1, 10)) AS first_order_day,
                 MAX(substr(order_date, 1, 10)) AS last_order_day
          FROM sales_orders
          WHERE lower(trim(source_system)) NOT IN
            ('shopee', 'lazada', 'tiktok', 'line', 'whatsapp', 'etsy', 'ebay', 'facebook', 'website', 'manual')
          GROUP BY source_system
          ORDER BY orders DESC`,
  },
  unknown_status: {
    description: "Orders whose status is outside the known status taxonomy",
    sql: `SELECT substr(order_date, 1, 10) AS order_day, source_system, source_order_id, status, order_total, currency
          FROM sales_orders
          WHERE status IS NULL OR lower(status) NOT IN
            ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded', 'archived')
          ORDER BY order_date DESC, id`,
  },
  sync_errors: {
    description: "Sync runs with a failed/partial/error status in the last 7 days",
    sql: `SELECT id, source, scenario, started_at, finished_at, status,
                 records_received, records_rejected, substr(COALESCE(error_message, ''), 1, 300) AS error_message
          FROM sync_runs
          WHERE status IN ('failed', 'partial', 'error')
            AND COALESCE(finished_at, created_at) >= datetime('now', '-7 day')
          ORDER BY COALESCE(finished_at, created_at) DESC`,
  },
};

async function getExceptions(env: any, url: URL): Promise<Response> {
  const type = (url.searchParams.get("type") || "").trim();
  const def = EXCEPTION_TYPES[type];
  if (!def) {
    return err("INVALID_EXCEPTION_TYPE", "type must be one of: " + Object.keys(EXCEPTION_TYPES).join(", "));
  }
  const rows = await env.DB.prepare(def.sql + " LIMIT 100").all();
  return json({
    success: true,
    type,
    description: def.description,
    count: (rows.results || []).length,
    truncated: (rows.results || []).length === 100,
    rows: rows.results || [],
  });
}

// ── Profitability (Phase 13) ──────────────────────────────────────────────
// Reads the migration-053 views. All amounts THB. Margins are NULL (never 0)
// when cost/fee/shipping inputs are missing; every aggregate carries its own
// covered-revenue base so percentages stay honest. Ad spend only appears in
// the month-level after_ads block (aggregate, never per order).

async function getProfitability(env: any, f: Filters): Promise<Response> {
  const range = dayRangeWhere(f);
  const binds: any[] = [...range.binds];
  let channelSql = "";
  if (f.channel) { channelSql = " AND channel_norm = ?"; binds.push(f.channel); }

  try {
    const summary: any = await env.DB.prepare(
      `SELECT
         COUNT(*)                                                   AS orders,
         SUM(order_total)                                           AS revenue,
         SUM(cost_coverage = 'FULL')                                AS full_cost_orders,
         SUM(cost_coverage = 'PARTIAL')                             AS partial_cost_orders,
         SUM(cost_coverage = 'NONE')                                AS no_cost_orders,
         SUM(cost_coverage = 'ITEMLESS')                            AS itemless_orders,
         SUM(CASE WHEN gross_margin_thb IS NOT NULL THEN order_total END) AS gross_covered_revenue,
         SUM(CASE WHEN gross_margin_thb IS NOT NULL THEN production_cost_thb END) AS production_cost_thb,
         SUM(gross_margin_thb)                                      AS gross_margin_thb,
         SUM(CASE WHEN contribution_before_shipping_thb IS NOT NULL THEN fees_thb END) AS fees_thb,
         SUM(CASE WHEN contribution_before_shipping_thb IS NOT NULL THEN order_total END) AS contrib_bs_covered_revenue,
         SUM(contribution_before_shipping_thb)                      AS contribution_before_shipping_thb,
         SUM(CASE WHEN contribution_margin_thb IS NOT NULL THEN shipping_cost_thb END) AS shipping_cost_thb,
         SUM(CASE WHEN contribution_margin_thb IS NOT NULL THEN order_total END) AS contrib_covered_revenue,
         SUM(contribution_margin_thb)                               AS contribution_margin_thb,
         MAX(CASE WHEN estimate_cost_items > 0 OR fees_are_estimate = 1 OR shipping_is_estimate = 1 THEN 1 ELSE 0 END) AS contains_estimates
       FROM analysis_profit_orders
       WHERE 1=1${range.sql}${channelSql}`
    ).bind(...binds).first();

    const channels = await env.DB.prepare(
      `SELECT
         channel_norm,
         COUNT(*)                        AS orders,
         SUM(order_total)                AS revenue,
         SUM(cost_coverage = 'FULL')     AS full_cost_orders,
         SUM(CASE WHEN gross_margin_thb IS NOT NULL THEN order_total END) AS gross_covered_revenue,
         SUM(gross_margin_thb)           AS gross_margin_thb,
         SUM(CASE WHEN contribution_before_shipping_thb IS NOT NULL THEN order_total END) AS contrib_bs_covered_revenue,
         SUM(contribution_before_shipping_thb) AS contribution_before_shipping_thb,
         SUM(contribution_margin_thb)    AS contribution_margin_thb,
         MAX(CASE WHEN shipping_cost_thb IS NULL THEN 1 ELSE 0 END) AS shipping_missing
       FROM analysis_profit_orders
       WHERE 1=1${range.sql}${channelSql}
       GROUP BY channel_norm
       ORDER BY revenue DESC`
    ).bind(...binds).all();

    const monthBinds: any[] = [];
    let monthWhere = "";
    if (f.start) { monthWhere += " AND month >= ?"; monthBinds.push(f.start.slice(0, 7)); }
    if (f.end) { monthWhere += " AND month <= ?"; monthBinds.push(f.end.slice(0, 7)); }
    let monthChannelSql = "";
    if (f.channel) { monthChannelSql = " AND channel_norm = ?"; monthBinds.push(f.channel); }

    const monthly = await env.DB.prepare(
      `SELECT month,
              SUM(orders) AS orders,
              SUM(revenue) AS revenue,
              SUM(gross_covered_revenue) AS gross_covered_revenue,
              SUM(gross_margin_thb) AS gross_margin_thb,
              SUM(contrib_bs_covered_revenue) AS contrib_bs_covered_revenue,
              SUM(contribution_before_shipping_thb) AS contribution_before_shipping_thb,
              SUM(contribution_margin_thb) AS contribution_margin_thb,
              MAX(contains_estimates) AS contains_estimates
       FROM analysis_profit_monthly
       WHERE 1=1${monthWhere}${monthChannelSql}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 24`
    ).bind(...monthBinds).all();

    const prodBinds: any[] = [...range.binds];
    let prodChannelSql = "";
    if (f.channel) { prodChannelSql = " AND pi.channel_norm = ?"; prodBinds.push(f.channel); }

    const products = await env.DB.prepare(
      `SELECT
         pi.product_id,
         COALESCE(p.title_en, '(unmapped)') AS product_title,
         p.slug AS product_slug,
         COUNT(*) AS items,
         SUM(pi.quantity) AS units,
         SUM(CASE WHEN pi.revenue_status = 'EXACT' THEN pi.line_revenue END) AS exact_revenue,
         SUM(pi.cost_status = 'COSTED') AS costed_items,
         SUM(CASE WHEN pi.cost_status = 'COSTED' THEN pi.item_production_cost_thb END) AS production_cost_thb,
         SUM(CASE WHEN pi.revenue_status = 'EXACT' AND pi.cost_status = 'COSTED'
                  THEN pi.line_revenue - pi.item_production_cost_thb END) AS line_margin_before_fees_thb,
         SUM(CASE WHEN pi.revenue_status = 'EXACT' AND pi.cost_status = 'COSTED'
                  THEN pi.line_revenue END) AS line_margin_covered_revenue,
         MAX(pi.cost_is_estimate) AS cost_is_estimate
       FROM analysis_profit_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE 1=1${range.sql.replace(/order_day/g, "pi.order_day")}${prodChannelSql}
       GROUP BY pi.product_id, p.title_en, p.slug
       ORDER BY line_margin_before_fees_thb DESC NULLS LAST`
    ).bind(...prodBinds).all();

    const afterAds = await env.DB.prepare(
      `SELECT month, orders, revenue, contribution_before_shipping_thb,
              contrib_bs_covered_revenue, ads_cost_thb, contribution_after_ads_thb
       FROM analysis_profit_after_ads_monthly
       WHERE 1=1${monthWhere}
       ORDER BY month DESC
       LIMIT 24`
    ).bind(...monthBinds.slice(0, monthWhere.split("?").length - 1)).all();

    const coverage: any = await env.DB.prepare("SELECT * FROM analysis_profit_coverage").first();

    const pct = (num: any, base: any) => {
      const n = Number(num), b = Number(base);
      if (!Number.isFinite(n) || !Number.isFinite(b) || b <= 0) return null;
      return Math.round((n / b) * 1000) / 10;
    };

    return json({
      success: true,
      filters: { start: f.start, end: f.end, channel: f.channel },
      currency: "THB",
      note: "Margins are computed only over covered orders; percentages use each metric's own covered-revenue base. Estimates are labelled. Ad spend is month-aggregate only (never per order).",
      summary: {
        ...summary,
        gross_margin_pct: pct(summary?.gross_margin_thb, summary?.gross_covered_revenue),
        contribution_before_shipping_pct: pct(summary?.contribution_before_shipping_thb, summary?.contrib_bs_covered_revenue),
        contribution_margin_pct: pct(summary?.contribution_margin_thb, summary?.contrib_covered_revenue),
      },
      channels: channels.results || [],
      monthly: monthly.results || [],
      products: products.results || [],
      after_ads: afterAds.results || [],
      coverage,
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such table") || msg.includes("no such view")) {
      return err("PROFIT_VIEWS_MISSING", "Profitability views not found — apply migration 053_profitability_layer.sql first.", 500);
    }
    throw e;
  }
}

// ── Router ────────────────────────────────────────────────────────────────

export async function handleAdminAnalysis(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
      },
    });
  }
  const url = new URL(request.url);
  const isRecompute = request.method === "POST" && url.pathname.replace(/\/+$/, "").endsWith("/opportunity/recompute");
  if (request.method !== "GET" && !isRecompute) {
    return err("METHOD_NOT_ALLOWED", "Only GET is supported (POST only on /opportunity/recompute).", 405);
  }

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return err("UNAUTHORIZED", auth.error, auth.status);

  const sub = url.pathname.replace(/\/+$/, "").replace(/^\/api\/admin\/analysis/, "") || "/";

  const productMatch = sub.match(/^\/product\/(\d+)$/);
  if (productMatch) return getProductDetail(env, productMatch[1]);

  if (sub === "/data-quality") return getDataQuality(env);
  if (sub === "/data-quality/exceptions") return getExceptions(env, url);
  if (sub === "/opportunity") return getOpportunity(env);
  if (sub === "/opportunity/recompute") return recomputeOpportunityHandler(request, env);

  const parsed = parseFilters(url);
  if (!parsed.ok) return parsed.res;
  const f = parsed.f;

  if (sub === "/gsc") return getGsc(env, f);
  if (sub === "/ga4") return getGa4(env, f);
  if (sub === "/etsy") return getEtsy(env, f);
  if (sub === "/google-ads") return getGoogleAds(env, f);
  if (sub === "/growth-signals") return getGrowthSignals(env, f);
  if (sub === "/profitability") return getProfitability(env, f);
  if (sub === "/" || sub === "/summary") return getSummary(env, f);
  if (sub === "/sales") return getSales(env, f);
  if (sub === "/products") return getProducts(env, f);
  if (sub === "/channels") return getChannels(env, f);

  return err("ROUTE_NOT_FOUND", "Unknown analysis route: " + sub, 404);
}
