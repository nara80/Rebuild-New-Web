const ETSY_SERVICE_NAME = "mildmate-etsy-api";
const ETSY_SYNC_TOKEN_SECRET_NAME = "SALES_SYNC_API_TOKEN";

type AnyObj = Record<string, any>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN_INACTIVE_STATES = new Set(["inactive", "deactivated", "expired", "removed", "draft", "sold_out"]);

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

function toNonNegativeInt(v: any, fieldName: string, fallback = 0): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${fieldName} must be a non-negative number`);
  return Math.round(n);
}

function normalizeDate(v: any): string {
  const s = trimTo(v, 20);
  if (!DATE_RE.test(s)) throw new Error("date must be YYYY-MM-DD");
  return s;
}

function normalizeListingId(v: any): string {
  const s = trimTo(v, 120);
  if (!s) throw new Error("listing_id is required");
  return s;
}

function normalizeCurrency(v: any): string {
  return trimTo(v || "USD", 10).toUpperCase();
}

function normalizeListingState(v: any): string {
  return trimTo(v || "active", 60).toLowerCase();
}

function normalizeBoolean(v: any, fallback: boolean): boolean {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "active"].includes(s)) return true;
  if (["0", "false", "no", "n", "inactive"].includes(s)) return false;
  return fallback;
}

function inferActive(state: string): boolean {
  if (!state) return true;
  return !KNOWN_INACTIVE_STATES.has(state);
}

function parseProductIdsJson(raw: any): number[] {
  try {
    const arr = JSON.parse(String(raw));
    if (!Array.isArray(arr)) return [];
    return arr.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0);
  } catch {
    return [];
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
  const configured = trimTo(env[ETSY_SYNC_TOKEN_SECRET_NAME], 500);
  if (!configured) {
    return {
      ok: false,
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: `${ETSY_SYNC_TOKEN_SECRET_NAME} is not configured`,
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

async function productExists(env: any, productId: number, cache: Map<number, boolean>): Promise<boolean> {
  if (cache.has(productId)) return !!cache.get(productId);
  const row: any = await env.DB.prepare(`SELECT id FROM products WHERE id = ?1 LIMIT 1`).bind(productId).first();
  const ok = !!row?.id;
  cache.set(productId, ok);
  return ok;
}

async function resolveListingAliasProduct(env: any, listingId: string): Promise<{ productId: number | null; mappingScope: string }> {
  const norm = trimTo(listingId, 120).toLowerCase();
  const row: any = await env.DB.prepare(
    `SELECT product_ids
     FROM product_mapping_aliases
     WHERE match_scope = 'listing'
       AND verified = 1
       AND (COALESCE(source_system, '') = '' OR lower(source_system) = 'etsy')
       AND (listing_id = ?1 OR alias_norm = ?2)
     ORDER BY (CASE WHEN lower(COALESCE(source_system, '')) = 'etsy' THEN 1 ELSE 0 END) DESC,
              verified DESC,
              id ASC
     LIMIT 1`
  )
    .bind(listingId, norm)
    .first();

  if (!row) return { productId: null, mappingScope: "unmapped" };
  const ids = parseProductIdsJson(row.product_ids);
  if (ids.length === 1) return { productId: ids[0], mappingScope: "alias_listing" };
  if (ids.length > 1) return { productId: null, mappingScope: "alias_multi_product" };
  return { productId: null, mappingScope: "unmapped" };
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

  const source = trimTo(body.sync_source, 80) || "etsy-structured-import";
  const scenario = trimTo(body.scenario, 200) || "phase11-etsy-collector";
  const runId = await createSyncRun(env, source, scenario, rowsRaw.length);

  const nowIso = new Date().toISOString();
  const productExistenceCache = new Map<number, boolean>();
  const masterCache = new Map<string, AnyObj | null>();
  const aliasCache = new Map<string, { productId: number | null; mappingScope: string }>();

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
        const listingId = normalizeListingId(raw.listing_id || raw.etsy_listing_id || raw.listing);
        const listingState = normalizeListingState(raw.listing_state || raw.state || raw.status || "active");
        const isActive = normalizeBoolean(raw.is_active, inferActive(listingState)) ? 1 : 0;
        const currency = normalizeCurrency(raw.currency || raw.order_currency || "USD");

        const visits = toNonNegativeInt(raw.visits ?? raw.visit_count, "visits", 0);
        const views = toNonNegativeInt(raw.views ?? raw.view_count, "views", 0);
        const favorites = toNonNegativeInt(raw.favorites ?? raw.favorers ?? raw.favorite_count, "favorites", 0);
        const orders = toNonNegativeInt(raw.orders ?? raw.order_count, "orders", 0);
        const transactions = toNonNegativeInt(raw.transactions ?? raw.transaction_count, "transactions", 0);
        const unitsSold = toNonNegativeInt(raw.units_sold ?? raw.quantity_sold ?? raw.items_sold, "units_sold", 0);

        const revenue = toNum(raw.revenue ?? raw.revenue_amount ?? raw.gross_revenue);
        if (revenue !== null && revenue < 0) throw new Error("revenue must be >= 0");
        const revenueThbInput = toNum(raw.revenue_thb);
        if (revenueThbInput !== null && revenueThbInput < 0) throw new Error("revenue_thb must be >= 0");
        const fxToThb = toNum(raw.fx_rate_to_thb ?? raw.exchange_rate_to_thb ?? raw.thb_rate);
        if (fxToThb !== null && fxToThb <= 0) throw new Error("fx_rate_to_thb must be > 0");
        const revenueThb = revenueThbInput !== null
          ? revenueThbInput
          : (revenue !== null && fxToThb !== null ? Math.round(revenue * fxToThb * 100) / 100 : null);

        const explicitProductIdRaw = raw.product_id ?? raw.Product_ID;
        const explicitProductId = explicitProductIdRaw === undefined || explicitProductIdRaw === null || explicitProductIdRaw === ""
          ? null
          : Number(explicitProductIdRaw);
        if (explicitProductId !== null && (!Number.isInteger(explicitProductId) || explicitProductId <= 0)) {
          throw new Error("product_id must be a positive integer when provided");
        }
        if (explicitProductId !== null && !(await productExists(env, explicitProductId, productExistenceCache))) {
          throw new Error(`product_id ${explicitProductId} does not exist in products`);
        }

        if (!masterCache.has(listingId)) {
          const masterRow: AnyObj | null = await env.DB.prepare(
            `SELECT listing_id, shop_id, shop_name, listing_title, listing_state, is_active, listing_url,
                    currency, price, quantity_available, views_total, favorites_total, product_id, mapping_scope
             FROM etsy_listing_master
             WHERE listing_id = ?1
             LIMIT 1`
          ).bind(listingId).first();
          masterCache.set(listingId, masterRow || null);
        }
        const existingMaster = masterCache.get(listingId) || null;

        if (!aliasCache.has(listingId)) {
          aliasCache.set(listingId, await resolveListingAliasProduct(env, listingId));
        }
        const aliasResolved = aliasCache.get(listingId)!;

        let resolvedProductId: number | null = null;
        let resolvedScope = "unmapped";
        if (explicitProductId !== null) {
          resolvedProductId = explicitProductId;
          resolvedScope = "explicit_product_id";
        } else if (existingMaster?.product_id) {
          resolvedProductId = Number(existingMaster.product_id);
          resolvedScope = trimTo(existingMaster.mapping_scope, 80) || "listing_master";
        } else if (aliasResolved.productId) {
          resolvedProductId = aliasResolved.productId;
          resolvedScope = aliasResolved.mappingScope;
        } else if (aliasResolved.mappingScope === "alias_multi_product") {
          resolvedScope = aliasResolved.mappingScope;
        }

        const listingTitle = trimTo(raw.listing_title || raw.title || existingMaster?.listing_title, 500);
        const listingUrl = trimTo(raw.listing_url || raw.url || existingMaster?.listing_url, 1000);
        const shopId = trimTo(raw.shop_id || existingMaster?.shop_id, 120);
        const shopName = trimTo(raw.shop_name || existingMaster?.shop_name, 200);
        const price = toNum(raw.price ?? existingMaster?.price);
        if (price !== null && price < 0) throw new Error("price must be >= 0");
        const quantityAvailable = toNum(raw.quantity_available ?? raw.stock_quantity ?? existingMaster?.quantity_available);
        if (quantityAvailable !== null && quantityAvailable < 0) throw new Error("quantity_available must be >= 0");
        const viewsTotal = toNum(raw.views_total ?? raw.total_views ?? existingMaster?.views_total);
        if (viewsTotal !== null && viewsTotal < 0) throw new Error("views_total must be >= 0");
        const favoritesTotal = toNum(raw.favorites_total ?? raw.total_favorites ?? existingMaster?.favorites_total);
        if (favoritesTotal !== null && favoritesTotal < 0) throw new Error("favorites_total must be >= 0");

        const effectiveProductId = resolvedProductId !== null ? resolvedProductId : (existingMaster?.product_id ? Number(existingMaster.product_id) : null);
        const effectiveMappingScope = effectiveProductId !== null
          ? resolvedScope
          : (trimTo(existingMaster?.mapping_scope, 80) || resolvedScope || "unmapped");

        await env.DB.prepare(
          `INSERT INTO etsy_listing_master
             (listing_id, shop_id, shop_name, listing_title, listing_state, is_active, listing_url, currency,
              price, quantity_available, views_total, favorites_total, product_id, mapping_scope,
              source_updated_at, first_seen_at, last_seen_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15, ?15)
           ON CONFLICT(listing_id) DO UPDATE SET
             shop_id = excluded.shop_id,
             shop_name = excluded.shop_name,
             listing_title = excluded.listing_title,
             listing_state = excluded.listing_state,
             is_active = excluded.is_active,
             listing_url = excluded.listing_url,
             currency = excluded.currency,
             price = excluded.price,
             quantity_available = excluded.quantity_available,
             views_total = excluded.views_total,
             favorites_total = excluded.favorites_total,
             product_id = excluded.product_id,
             mapping_scope = excluded.mapping_scope,
             source_updated_at = excluded.source_updated_at,
             last_seen_at = excluded.last_seen_at,
             updated_at = CURRENT_TIMESTAMP`
        ).bind(
          listingId,
          shopId,
          shopName,
          listingTitle,
          listingState,
          isActive,
          listingUrl,
          currency,
          price,
          quantityAvailable === null ? null : Math.round(quantityAvailable),
          viewsTotal === null ? null : Math.round(viewsTotal),
          favoritesTotal === null ? null : Math.round(favoritesTotal),
          effectiveProductId,
          effectiveMappingScope,
          nowIso
        ).run();

        masterCache.set(listingId, {
          listing_id: listingId,
          shop_id: shopId,
          shop_name: shopName,
          listing_title: listingTitle,
          listing_state: listingState,
          is_active: isActive,
          listing_url: listingUrl,
          currency,
          price,
          quantity_available: quantityAvailable === null ? null : Math.round(quantityAvailable),
          views_total: viewsTotal === null ? null : Math.round(viewsTotal),
          favorites_total: favoritesTotal === null ? null : Math.round(favoritesTotal),
          product_id: effectiveProductId,
          mapping_scope: effectiveMappingScope,
        });

        const existing: AnyObj | null = await env.DB.prepare(
          `SELECT id, listing_title, listing_state, is_active, visits, views, favorites, orders, transactions,
                  units_sold, revenue, revenue_thb, product_id, mapping_scope
           FROM etsy_listing_daily
           WHERE report_date = ?1 AND listing_id = ?2 AND currency = ?3
           LIMIT 1`
        ).bind(reportDate, listingId, currency).first();

        if (!existing) {
          await env.DB.prepare(
            `INSERT INTO etsy_listing_daily
               (report_date, listing_id, listing_title, listing_state, is_active, currency,
                visits, views, favorites, orders, transactions, units_sold, revenue, revenue_thb,
                product_id, mapping_scope, source_updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`
          ).bind(
            reportDate,
            listingId,
            listingTitle,
            listingState,
            isActive,
            currency,
            visits,
            views,
            favorites,
            orders,
            transactions,
            unitsSold,
            revenue,
            revenueThb,
            effectiveProductId,
            effectiveMappingScope,
            nowIso
          ).run();
          created++;
          continue;
        }

        const noChange =
          sameNullable(existing.listing_title, listingTitle) &&
          sameNullable(existing.listing_state, listingState) &&
          Number(existing.is_active || 0) === isActive &&
          Number(existing.visits || 0) === visits &&
          Number(existing.views || 0) === views &&
          Number(existing.favorites || 0) === favorites &&
          Number(existing.orders || 0) === orders &&
          Number(existing.transactions || 0) === transactions &&
          Number(existing.units_sold || 0) === unitsSold &&
          sameNullableNum(existing.revenue, revenue) &&
          sameNullableNum(existing.revenue_thb, revenueThb) &&
          sameNullable(existing.product_id, effectiveProductId) &&
          sameNullable(existing.mapping_scope, effectiveMappingScope);

        if (noChange) {
          unchanged++;
          continue;
        }

        await env.DB.prepare(
          `UPDATE etsy_listing_daily
           SET listing_title = ?1,
               listing_state = ?2,
               is_active = ?3,
               visits = ?4,
               views = ?5,
               favorites = ?6,
               orders = ?7,
               transactions = ?8,
               units_sold = ?9,
               revenue = ?10,
               revenue_thb = ?11,
               product_id = ?12,
               mapping_scope = ?13,
               source_updated_at = ?14,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?15`
        ).bind(
          listingTitle,
          listingState,
          isActive,
          visits,
          views,
          favorites,
          orders,
          transactions,
          unitsSold,
          revenue,
          revenueThb,
          effectiveProductId,
          effectiveMappingScope,
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
        error_code: "ETSY_UPSERT_FAILED",
        message: String(e?.message || e),
        run_id: runId,
      },
      500
    );
  }
}

export async function handleEtsyApi(request: Request, env: any): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method.toUpperCase();

  if (!path.startsWith("/v1/etsy") && !path.startsWith("/api/v1/etsy")) return null;
  if (method === "OPTIONS") return response({ ok: true });

  if (method === "GET" && (path === "/v1/etsy/health" || path === "/api/v1/etsy/health")) {
    return response({ ok: true, service: ETSY_SERVICE_NAME });
  }

  if (method === "POST" && (path === "/v1/etsy/rows/upsert" || path === "/api/v1/etsy/rows/upsert")) {
    return handleRowsUpsert(request, env);
  }

  return response({ success: false, error_code: "ROUTE_NOT_FOUND", message: "Etsy route not found." }, 404);
}
