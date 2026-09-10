// MildMate Admin API — Marketing Analysis (read-only)
// Phase 04 of the Marketing Decision System.
//
// GET /api/admin/analysis/summary       ?start&end&channel
// GET /api/admin/analysis/sales         ?start&end&channel&product_id&status&revenue_status&limit&offset
// GET /api/admin/analysis/products      ?start&end&channel
// GET /api/admin/analysis/product/:id
// GET /api/admin/analysis/channels      ?start&end
// GET /api/admin/analysis/data-quality
//
// Reads ONLY the analysis_* views from migration 042 (plus products for titles).
// Metric semantics: 01_MildMate_Marketing/02_Metric_Dictionary/Phase_02_Metric_Contract_2026-09-07.md
// No PII: the unified sales tables carry no customer fields.

import { verifyClerkJwt } from "./clerk-verify";

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

// ── Router ────────────────────────────────────────────────────────────────

export async function handleAdminAnalysis(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
      },
    });
  }
  if (request.method !== "GET") return err("METHOD_NOT_ALLOWED", "Only GET is supported.", 405);

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return err("UNAUTHORIZED", auth.error, auth.status);

  const url = new URL(request.url);
  const sub = url.pathname.replace(/\/+$/, "").replace(/^\/api\/admin\/analysis/, "") || "/";

  const productMatch = sub.match(/^\/product\/(\d+)$/);
  if (productMatch) return getProductDetail(env, productMatch[1]);

  if (sub === "/data-quality") return getDataQuality(env);
  if (sub === "/data-quality/exceptions") return getExceptions(env, url);

  const parsed = parseFilters(url);
  if (!parsed.ok) return parsed.res;
  const f = parsed.f;

  if (sub === "/" || sub === "/summary") return getSummary(env, f);
  if (sub === "/sales") return getSales(env, f);
  if (sub === "/products") return getProducts(env, f);
  if (sub === "/channels") return getChannels(env, f);

  return err("ROUTE_NOT_FOUND", "Unknown analysis route: " + sub, 404);
}
