const GSC_SERVICE_NAME = "mildmate-gsc-api";
const GSC_SYNC_TOKEN_SECRET_NAME = "SALES_SYNC_API_TOKEN";

type AnyObj = Record<string, any>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_DEVICE = new Set(["", "DESKTOP", "MOBILE", "TABLET"]);
const ALLOWED_SEARCH_TYPE = new Set(["web", "image", "video", "news", "discover", "google_news"]);

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

function normalizeDate(v: any): string {
  const s = trimTo(v, 20);
  if (!DATE_RE.test(s)) throw new Error("date must be YYYY-MM-DD");
  return s;
}

function normalizeQuery(v: any): { queryText: string; queryNorm: string } {
  const queryText = trimTo(v, 1000);
  if (!queryText) throw new Error("query is required");
  const queryNorm = queryText.toLowerCase().replace(/\s+/g, " ").trim();
  if (!queryNorm) throw new Error("query is required");
  return { queryText, queryNorm };
}

function normalizeCountry(v: any): string {
  return trimTo(v, 20).toUpperCase();
}

function normalizeDevice(v: any): string {
  const device = trimTo(v, 20).toUpperCase();
  if (!ALLOWED_DEVICE.has(device)) throw new Error("device must be one of: DESKTOP, MOBILE, TABLET");
  return device;
}

function normalizeSearchType(v: any): string {
  const t = trimTo(v, 40).toLowerCase() || "web";
  if (!ALLOWED_SEARCH_TYPE.has(t)) throw new Error("search_type is invalid");
  return t;
}

function normalizeSearchAppearance(v: any): string {
  return trimTo(v, 120);
}

function normalizePage(pageRaw: any, propertyHintRaw: any): { pageUrl: string; pagePath: string } {
  const raw = trimTo(pageRaw, 2000);
  if (!raw) throw new Error("page is required");

  let pageUrl = raw;
  let pagePath = raw;

  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      const path = u.pathname || "/";
      pagePath = path;
      pageUrl = `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
    } else if (raw.startsWith("/")) {
      pagePath = raw;
      const propertyHint = trimTo(propertyHintRaw, 300);
      if (propertyHint.startsWith("http://") || propertyHint.startsWith("https://")) {
        const p = new URL(propertyHint);
        pageUrl = `${p.protocol}//${p.hostname.toLowerCase()}${raw}`;
      } else if (propertyHint.startsWith("sc-domain:")) {
        const host = propertyHint.slice("sc-domain:".length).trim().toLowerCase();
        if (host) pageUrl = `https://${host}${raw}`;
      } else {
        pageUrl = raw;
      }
    } else {
      pagePath = "/" + raw;
      pageUrl = pagePath;
    }
  } catch {
    if (!raw.startsWith("/")) pagePath = "/" + raw;
    pageUrl = pagePath;
  }

  pagePath = pagePath.replace(/\\/g, "/");
  pagePath = pagePath.replace(/\/{2,}/g, "/");
  if (!pagePath.startsWith("/")) pagePath = "/" + pagePath;
  if (pagePath.length > 1 && pagePath.endsWith("/")) pagePath = pagePath.slice(0, -1);

  if (!pageUrl.startsWith("http://") && !pageUrl.startsWith("https://")) {
    pageUrl = pagePath;
  } else {
    try {
      const u = new URL(pageUrl);
      pageUrl = `${u.protocol}//${u.hostname.toLowerCase()}${pagePath}`;
    } catch {}
  }

  return { pageUrl: pageUrl.slice(0, 2000), pagePath: pagePath.slice(0, 1000) };
}

function extractProductSlug(pagePath: string): string | null {
  const m = pagePath.match(/^\/(?:th\/)?product\/([^\/?#]+)\/?$/i);
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

async function requireBearerAuth(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const configured = trimTo(env[GSC_SYNC_TOKEN_SECRET_NAME], 500);
  if (!configured) {
    return {
      ok: false,
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: `${GSC_SYNC_TOKEN_SECRET_NAME} is not configured`,
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
  ).bind(source, scenario || null, new Date().toISOString(), Number(received || 0)).run();
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
  ).bind(
    data.status,
    new Date().toISOString(),
    Number(data.created || 0),
    Number(data.updated || 0),
    Number(data.unchanged || 0),
    Number(data.rejected || 0),
    data.error ? String(data.error).slice(0, 500) : null,
    runId
  ).run();
}

async function resolveProductIdBySlug(env: any, slug: string, cache: Map<string, number | null>): Promise<number | null> {
  if (cache.has(slug)) return cache.get(slug) || null;
  const row: any = await env.DB.prepare(
    `SELECT id FROM products WHERE lower(slug) = ?1 LIMIT 1`
  ).bind(slug).first();
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

  const rowsRaw = Array.isArray(body.rows)
    ? body.rows
    : body.row && typeof body.row === "object"
      ? [body.row]
      : [];
  if (!rowsRaw.length) {
    return response({ success: false, error_code: "MISSING_ROWS", message: "rows[] (or row) is required." }, 400);
  }
  if (rowsRaw.length > 5000) {
    return response({ success: false, error_code: "TOO_MANY_ROWS", message: "Maximum 5000 rows per request." }, 400);
  }

  const source = trimTo(body.sync_source, 80) || "gsc-make-collector";
  const scenario = trimTo(body.scenario, 200) || "phase09-gsc-collector";
  const propertyHint = trimTo(body.property || body.site_url || body.site, 300);
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
        const q = normalizeQuery(raw.query || raw.query_text);
        const page = normalizePage(raw.page || raw.page_url || raw.landing_page, propertyHint);
        const country = normalizeCountry(raw.country);
        const device = normalizeDevice(raw.device);
        const searchType = normalizeSearchType(raw.search_type);
        const searchAppearance = normalizeSearchAppearance(raw.search_appearance);

        const clicksNum = toNum(raw.clicks);
        if (clicksNum === null || clicksNum < 0) throw new Error("clicks must be a non-negative number");
        const impressionsNum = toNum(raw.impressions);
        if (impressionsNum === null || impressionsNum < 0) throw new Error("impressions must be a non-negative number");

        const clicks = Math.round(clicksNum);
        const impressions = Math.round(impressionsNum);
        const ctrInput = toNum(raw.ctr);
        const ctr = ctrInput === null
          ? (impressions > 0 ? Math.round((clicks / impressions) * 1000000) / 1000000 : null)
          : ctrInput;
        const position = toNum(raw.position);
        if (position !== null && position < 0) throw new Error("position must be >= 0");

        const slug = extractProductSlug(page.pagePath);
        let productId: number | null = null;
        let mappingScope = "non_product";
        if (slug) {
          productId = await resolveProductIdBySlug(env, slug, slugCache);
          mappingScope = productId ? "mapped_product" : "unknown_product_slug";
        }

        const existing: any = await env.DB.prepare(
          `SELECT id, query_text, page_path, clicks, impressions, ctr, position, product_id, mapping_scope
           FROM gsc_search_daily
           WHERE report_date = ?1 AND query_norm = ?2 AND page_url = ?3
             AND country = ?4 AND device = ?5 AND search_type = ?6 AND search_appearance = ?7
           LIMIT 1`
        ).bind(reportDate, q.queryNorm, page.pageUrl, country, device, searchType, searchAppearance).first();

        if (!existing) {
          await env.DB.prepare(
            `INSERT INTO gsc_search_daily
             (report_date, query_text, query_norm, page_url, page_path, country, device, search_type, search_appearance,
              clicks, impressions, ctr, position, product_id, mapping_scope, source_updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
          ).bind(
            reportDate,
            q.queryText,
            q.queryNorm,
            page.pageUrl,
            page.pagePath,
            country,
            device,
            searchType,
            searchAppearance,
            clicks,
            impressions,
            ctr,
            position,
            productId,
            mappingScope,
            nowIso
          ).run();
          created++;
          continue;
        }

        const noChange =
          sameNullable(existing.query_text, q.queryText) &&
          sameNullable(existing.page_path, page.pagePath) &&
          Number(existing.clicks || 0) === clicks &&
          Number(existing.impressions || 0) === impressions &&
          sameNullableNum(existing.ctr, ctr) &&
          sameNullableNum(existing.position, position) &&
          sameNullable(existing.product_id, productId) &&
          sameNullable(existing.mapping_scope, mappingScope);

        if (noChange) {
          unchanged++;
          continue;
        }

        await env.DB.prepare(
          `UPDATE gsc_search_daily
           SET query_text = ?1,
               page_path = ?2,
               clicks = ?3,
               impressions = ?4,
               ctr = ?5,
               position = ?6,
               product_id = ?7,
               mapping_scope = ?8,
               source_updated_at = ?9,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?10`
        ).bind(
          q.queryText,
          page.pagePath,
          clicks,
          impressions,
          ctr,
          position,
          productId,
          mappingScope,
          nowIso,
          Number(existing.id)
        ).run();
        updated++;
      } catch (e: any) {
        rejected++;
        if (rejects.length < 25) rejects.push({ index: i, reason: String(e?.message || e).slice(0, 180) });
      }
    }

    const status: "success" | "partial" | "failed" =
      rejected === 0 ? "success" : (created + updated + unchanged > 0 ? "partial" : "failed");
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
        error_code: "GSC_UPSERT_FAILED",
        message: String(e?.message || e),
        run_id: runId,
      },
      500
    );
  }
}

export async function handleGscApi(request: Request, env: any): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method.toUpperCase();

  if (!path.startsWith("/v1/gsc") && !path.startsWith("/api/v1/gsc")) return null;
  if (method === "OPTIONS") return response({ ok: true });

  if (method === "GET" && (path === "/v1/gsc/health" || path === "/api/v1/gsc/health")) {
    return response({ ok: true, service: GSC_SERVICE_NAME });
  }

  if (method === "POST" && (path === "/v1/gsc/rows/upsert" || path === "/api/v1/gsc/rows/upsert")) {
    return handleRowsUpsert(request, env);
  }

  return response({ success: false, error_code: "ROUTE_NOT_FOUND", message: "GSC route not found." }, 404);
}
