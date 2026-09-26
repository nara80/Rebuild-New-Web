const GA4_SERVICE_NAME = "mildmate-ga4-api";
const GA4_SYNC_TOKEN_SECRET_NAME = "SALES_SYNC_API_TOKEN";

type AnyObj = Record<string, any>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_DEVICE = new Set(["", "desktop", "mobile", "tablet"]);

function response(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function trimTo(v: any, max = 255): string {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max);
}

function toNum(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toNonNegativeInt(v: any, fieldName: string): number {
  const n = toNum(v);
  if (n === null || n < 0) throw new Error(`${fieldName} must be a non-negative number`);
  return Math.round(n);
}

function normalizeDate(v: any): string {
  const s = trimTo(v, 20);
  if (!DATE_RE.test(s)) throw new Error("date must be YYYY-MM-DD");
  return s;
}

function normalizePath(pathRaw: any): string {
  const raw = trimTo(pathRaw, 2000);
  if (!raw) return "";

  let path = raw;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      path = u.pathname || "/";
    } else {
      const u = new URL(raw, "https://mildmate.local");
      path = u.pathname || raw;
    }
  } catch {
    const qIdx = raw.indexOf("?");
    const hIdx = raw.indexOf("#");
    const cutAt = [qIdx, hIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    path = cutAt >= 0 ? raw.slice(0, cutAt) : raw;
  }

  path = path.replace(/\\/g, "/");
  path = path.replace(/\/{2,}/g, "/");
  if (!path.startsWith("/")) path = "/" + path;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path.slice(0, 1000);
}

function normalizeDevice(v: any): string {
  const d = trimTo(v, 30).toLowerCase();
  if (!ALLOWED_DEVICE.has(d)) throw new Error("device must be one of: desktop, mobile, tablet");
  return d;
}

function normalizeDim(v: any, max = 120): string {
  const out = trimTo(v, max);
  if (out.toLowerCase() === "(not set)") return "";
  return out;
}

function extractProductSlug(path: string): string | null {
  const m = String(path || "").match(/^\/(?:th\/)?product\/([^\/?#]+)\/?$/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).trim().toLowerCase();
  } catch {
    return m[1].trim().toLowerCase();
  }
}

function sameNullable(a: any, b: any): boolean {
  const x = a === undefined || a === null || a === "" ? null : a;
  const y = b === undefined || b === null || b === "" ? null : b;
  if (x === null && y === null) return true;
  return String(x) === String(y);
}

function sameNullableNum(a: any, b: any): boolean {
  const x = a === undefined || a === null || a === "" ? null : Number(a);
  const y = b === undefined || b === null || b === "" ? null : Number(b);
  if (x === null && y === null) return true;
  if (x === null || y === null) return false;
  return Math.abs(x - y) < 0.000001;
}

async function requireBearerAuth(
  request: Request,
  env: any
): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const configured = trimTo(env[GA4_SYNC_TOKEN_SECRET_NAME], 500);
  if (!configured) {
    return {
      ok: false,
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: `${GA4_SYNC_TOKEN_SECRET_NAME} is not configured`,
    };
  }
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Missing Bearer token" };
  }
  const supplied = auth.slice(7).trim();
  if (!supplied || supplied !== configured) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Invalid Bearer token" };
  }
  return { ok: true };
}

async function createSyncRun(env: any, source: string, scenario: string, received: number): Promise<number> {
  const ins = await env.DB.prepare(
    `INSERT INTO sync_runs (source, scenario, started_at, status, records_received)
     VALUES (?1, ?2, ?3, 'running', ?4)`
  )
    .bind(source, scenario || null, new Date().toISOString(), Number(received || 0))
    .run();
  return Number(ins.meta?.last_row_id || 0);
}

async function finishSyncRun(
  env: any,
  runId: number,
  data: {
    status: "success" | "partial" | "failed";
    created?: number;
    updated?: number;
    unchanged?: number;
    rejected?: number;
    error?: string | null;
  }
): Promise<void> {
  if (!runId) return;
  await env.DB.prepare(
    `UPDATE sync_runs
     SET status = ?1,
         finished_at = ?2,
         records_created = ?3,
         records_updated = ?4,
         records_unchanged = ?5,
         records_rejected = ?6,
         error_message = ?7
     WHERE id = ?8`
  )
    .bind(
      data.status,
      new Date().toISOString(),
      Number(data.created || 0),
      Number(data.updated || 0),
      Number(data.unchanged || 0),
      Number(data.rejected || 0),
      data.error ? String(data.error).slice(0, 500) : null,
      runId
    )
    .run();
}

async function resolveProductIdBySlug(env: any, slug: string, cache: Map<string, number | null>): Promise<number | null> {
  if (cache.has(slug)) return cache.get(slug) || null;
  const row: any = await env.DB.prepare(`SELECT id FROM products WHERE lower(slug) = ?1 LIMIT 1`).bind(slug).first();
  const id = row && row.id ? Number(row.id) : null;
  cache.set(slug, id);
  return id;
}

async function handleRowsUpsert(request: Request, env: any): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) return response({ success: false, error_code: auth.code, message: auth.message }, auth.status);

  let body: AnyObj;
  try {
    body = await request.json();
  } catch {
    return response({ success: false, error_code: "INVALID_JSON", message: "Body must be valid JSON." }, 400);
  }

  const rowsRaw = Array.isArray(body.rows) ? body.rows : body.row && typeof body.row === "object" ? [body.row] : [];
  if (!rowsRaw.length) {
    return response({ success: false, error_code: "MISSING_ROWS", message: "rows[] (or row) is required." }, 400);
  }
  if (rowsRaw.length > 5000) {
    return response({ success: false, error_code: "TOO_MANY_ROWS", message: "Maximum 5000 rows per request." }, 400);
  }

  const source = trimTo(body.sync_source, 80) || "ga4-manual-collector";
  const scenario = trimTo(body.scenario, 200) || "phase10-ga4-collector";
  const runId = await createSyncRun(env, source, scenario, rowsRaw.length);

  const slugCache = new Map<string, number | null>();
  const nowIso = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let rejected = 0;
  const rejects: Array<{ index: number; reason: string }> = [];

  try {
    for (let i = 0; i < rowsRaw.length; i++) {
      const raw = rowsRaw[i] || {};
      try {
        const reportDate = normalizeDate(raw.date || raw.report_date);
        const landingPagePath = normalizePath(raw.landing_page_path || raw.landing_page || raw.landingPage || "");
        const pagePath = normalizePath(raw.page_path || raw.pagePath || raw.page || "");
        const sourceDim = normalizeDim(raw.source, 120).toLowerCase();
        const medium = normalizeDim(raw.medium, 120).toLowerCase();
        const campaign = normalizeDim(raw.campaign, 180);
        const country = normalizeDim(raw.country, 120);
        const device = normalizeDevice(raw.device || "");

        const sessions = toNonNegativeInt(raw.sessions, "sessions");
        const users = toNonNegativeInt(raw.users, "users");
        const engagedSessions = toNonNegativeInt(raw.engaged_sessions, "engaged_sessions");
        const productViews = toNonNegativeInt(raw.product_views, "product_views");
        const addToCart = toNonNegativeInt(raw.add_to_cart, "add_to_cart");
        const beginCheckout = toNonNegativeInt(raw.begin_checkout, "begin_checkout");
        const purchases = toNonNegativeInt(raw.purchases, "purchases");
        const purchaseRevenue = toNum(raw.purchase_revenue);
        if (purchaseRevenue !== null && purchaseRevenue < 0) throw new Error("purchase_revenue must be >= 0");

        const candidatePath = pagePath || landingPagePath;
        const slug = extractProductSlug(candidatePath);
        let productId: number | null = null;
        let mappingScope = "non_product";
        if (slug) {
          productId = await resolveProductIdBySlug(env, slug, slugCache);
          mappingScope = productId ? "mapped_product" : "unknown_product_slug";
        }

        const existing: any = await env.DB.prepare(
          `SELECT id, sessions, users, engaged_sessions, product_views, add_to_cart, begin_checkout,
                  purchases, purchase_revenue, product_id, mapping_scope
             FROM ga4_funnel_daily
            WHERE report_date = ?1 AND landing_page_path = ?2 AND page_path = ?3
              AND source = ?4 AND medium = ?5 AND campaign = ?6 AND country = ?7 AND device = ?8
            LIMIT 1`
        )
          .bind(reportDate, landingPagePath, pagePath, sourceDim, medium, campaign, country, device)
          .first();

        if (!existing) {
          await env.DB.prepare(
            `INSERT INTO ga4_funnel_daily
             (report_date, landing_page_path, page_path, source, medium, campaign, country, device,
              sessions, users, engaged_sessions, product_views, add_to_cart, begin_checkout, purchases, purchase_revenue,
              product_id, mapping_scope, source_updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)`
          )
            .bind(
              reportDate,
              landingPagePath,
              pagePath,
              sourceDim,
              medium,
              campaign,
              country,
              device,
              sessions,
              users,
              engagedSessions,
              productViews,
              addToCart,
              beginCheckout,
              purchases,
              purchaseRevenue,
              productId,
              mappingScope,
              nowIso
            )
            .run();
          created++;
          continue;
        }

        const noChange =
          Number(existing.sessions || 0) === sessions &&
          Number(existing.users || 0) === users &&
          Number(existing.engaged_sessions || 0) === engagedSessions &&
          Number(existing.product_views || 0) === productViews &&
          Number(existing.add_to_cart || 0) === addToCart &&
          Number(existing.begin_checkout || 0) === beginCheckout &&
          Number(existing.purchases || 0) === purchases &&
          sameNullableNum(existing.purchase_revenue, purchaseRevenue) &&
          sameNullable(existing.product_id, productId) &&
          sameNullable(existing.mapping_scope, mappingScope);

        if (noChange) {
          unchanged++;
          continue;
        }

        await env.DB.prepare(
          `UPDATE ga4_funnel_daily
              SET sessions = ?1,
                  users = ?2,
                  engaged_sessions = ?3,
                  product_views = ?4,
                  add_to_cart = ?5,
                  begin_checkout = ?6,
                  purchases = ?7,
                  purchase_revenue = ?8,
                  product_id = ?9,
                  mapping_scope = ?10,
                  source_updated_at = ?11,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = ?12`
        )
          .bind(
            sessions,
            users,
            engagedSessions,
            productViews,
            addToCart,
            beginCheckout,
            purchases,
            purchaseRevenue,
            productId,
            mappingScope,
            nowIso,
            Number(existing.id)
          )
          .run();
        updated++;
      } catch (e: any) {
        rejected++;
        if (rejects.length < 25) rejects.push({ index: i, reason: String(e?.message || e).slice(0, 180) });
      }
    }

    const status: "success" | "partial" | "failed" =
      rejected === 0 ? "success" : created + updated + unchanged > 0 ? "partial" : "failed";
    await finishSyncRun(env, runId, { status, created, updated, unchanged, rejected, error: null });

    return response({
      success: true,
      run_id: runId,
      source,
      scenario,
      totals: {
        received: rowsRaw.length,
        created,
        updated,
        unchanged,
        rejected,
      },
      rejected_samples: rejects,
    });
  } catch (e: any) {
    await finishSyncRun(env, runId, {
      status: "failed",
      created,
      updated,
      unchanged,
      rejected: rowsRaw.length - (created + updated + unchanged),
      error: String(e?.message || e),
    });
    return response(
      {
        success: false,
        error_code: "GA4_UPSERT_FAILED",
        message: String(e?.message || e),
        run_id: runId,
      },
      500
    );
  }
}

export async function handleGa4Api(request: Request, env: any): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method.toUpperCase();

  if (!path.startsWith("/v1/ga4") && !path.startsWith("/api/v1/ga4")) return null;
  if (method === "OPTIONS") return response({ ok: true });

  if (method === "GET" && (path === "/v1/ga4/health" || path === "/api/v1/ga4/health")) {
    return response({ ok: true, service: GA4_SERVICE_NAME });
  }

  if (method === "POST" && (path === "/v1/ga4/rows/upsert" || path === "/api/v1/ga4/rows/upsert")) {
    return handleRowsUpsert(request, env);
  }

  return response({ success: false, error_code: "ROUTE_NOT_FOUND", message: "GA4 route not found." }, 404);
}
