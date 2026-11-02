const GOOGLE_ADS_SERVICE_NAME = "mildmate-google-ads-api";
const GOOGLE_ADS_SYNC_TOKEN_SECRET_NAME = "SALES_SYNC_API_TOKEN";

type AnyObj = Record<string, any>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GOOGLE_ADS_SOURCE_SYSTEMS = new Set(["", "google-ads", "google_ads", "googleads"]);

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

function toNonNegativeReal(v: any, fieldName: string, fallback = 0): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${fieldName} must be a non-negative number`);
  return Math.round(n * 1000000) / 1000000;
}

function normalizeDate(v: any): string {
  const s = trimTo(v, 20);
  if (!DATE_RE.test(s)) throw new Error("date must be YYYY-MM-DD");
  return s;
}

function normalizeCurrency(v: any): string {
  return trimTo(v || "THB", 10).toUpperCase();
}

function normalizeText(v: any, max = 255): string {
  const out = trimTo(v, max);
  return out === "(not set)" ? "" : out;
}

function normalizeAliasCandidates(v: string): string[] {
  const raw = normalizeText(v, 500).toLowerCase().trim();
  if (!raw) return [];
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const compact = raw.replace(/[^a-z0-9]+/g, "");
  const out: string[] = [];
  if (collapsed) out.push(collapsed);
  if (compact && compact !== collapsed) out.push(compact);
  return Array.from(new Set(out));
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
  const configured = trimTo(env[GOOGLE_ADS_SYNC_TOKEN_SECRET_NAME], 500);
  if (!configured) {
    return {
      ok: false,
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: `${GOOGLE_ADS_SYNC_TOKEN_SECRET_NAME} is not configured`,
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

async function resolveAliasProduct(
  env: any,
  value: string
): Promise<{ productId: number | null; mappingScope: string }> {
  const idRaw = trimTo(value, 120);
  if (!idRaw) return { productId: null, mappingScope: "unmapped" };
  const aliases = normalizeAliasCandidates(idRaw);
  const aliasA = aliases[0] || "";
  const aliasB = aliases[1] || aliasA;

  const row: any = await env.DB.prepare(
    `SELECT source_system, listing_id, match_scope, product_ids
     FROM product_mapping_aliases
     WHERE verified = 1
       AND (listing_id = ?1 OR alias_norm = ?2 OR alias_norm = ?3)
     ORDER BY
       (CASE WHEN lower(COALESCE(source_system, '')) IN ('google-ads', 'google_ads', 'googleads') THEN 1 ELSE 0 END) DESC,
       (CASE WHEN lower(COALESCE(match_scope, '')) = 'listing' THEN 1 ELSE 0 END) DESC,
       id ASC
     LIMIT 1`
  )
    .bind(idRaw, aliasA, aliasB)
    .first();

  if (!row) return { productId: null, mappingScope: "unmapped" };
  const sourceSystem = String(row.source_system || "").toLowerCase().trim();
  if (!GOOGLE_ADS_SOURCE_SYSTEMS.has(sourceSystem)) return { productId: null, mappingScope: "unmapped" };

  const ids = parseProductIdsJson(row.product_ids);
  if (ids.length === 1) return { productId: ids[0], mappingScope: "alias" };
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

  const source = trimTo(body.sync_source, 80) || "google-ads-structured-import";
  const scenario = trimTo(body.scenario, 200) || "phase12-google-ads-collector";
  const runId = await createSyncRun(env, source, scenario, rowsRaw.length);

  const nowIso = new Date().toISOString();
  const productExistenceCache = new Map<number, boolean>();
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
        const customerId = normalizeText(raw.customer_id || raw.account_id || raw.customer || "", 120);
        if (!customerId) throw new Error("customer_id is required");
        const campaignId = normalizeText(raw.campaign_id || raw.campaign || "", 120);
        if (!campaignId) throw new Error("campaign_id is required");
        const adGroupId = normalizeText(raw.ad_group_id || raw.adgroup_id || raw.ad_group || "", 120);
        const campaignName = normalizeText(raw.campaign_name || raw.campaign_title || "", 300);
        const adGroupName = normalizeText(raw.ad_group_name || raw.adgroup_name || "", 300);
        const customerName = normalizeText(raw.customer_name || raw.account_name || "", 300);
        const channelType = normalizeText(raw.channel_type || raw.advertising_channel_type || "", 80).toLowerCase();
        const network = normalizeText(raw.network || raw.ad_network_type || "", 80).toLowerCase();
        const device = normalizeText(raw.device || "", 80).toLowerCase();
        const currency = normalizeCurrency(raw.currency || raw.currency_code || "THB");

        const impressions = toNonNegativeInt(raw.impressions, "impressions", 0);
        const clicks = toNonNegativeInt(raw.clicks, "clicks", 0);
        const costMicros = toNum(raw.cost_micros);
        if (costMicros !== null && costMicros < 0) throw new Error("cost_micros must be >= 0");
        const costRaw = raw.cost ?? raw.spend;
        let cost = toNonNegativeReal(costRaw, "cost", 0);
        if ((costRaw === undefined || costRaw === null || costRaw === "") && costMicros !== null) {
          cost = Math.round((costMicros / 1000000) * 1000000) / 1000000;
        }
        const conversions = toNonNegativeReal(raw.conversions, "conversions", 0);
        const conversionValue = toNonNegativeReal(raw.conversion_value ?? raw.conversions_value, "conversion_value", 0);
        const allConversions = toNum(raw.all_conversions);
        if (allConversions !== null && allConversions < 0) throw new Error("all_conversions must be >= 0");
        const allConversionsValue = toNum(raw.all_conversions_value);
        if (allConversionsValue !== null && allConversionsValue < 0) throw new Error("all_conversions_value must be >= 0");

        const explicitProductIdRaw = raw.product_id ?? raw.Product_ID;
        const explicitProductId =
          explicitProductIdRaw === undefined || explicitProductIdRaw === null || explicitProductIdRaw === ""
            ? null
            : Number(explicitProductIdRaw);
        if (explicitProductId !== null && (!Number.isInteger(explicitProductId) || explicitProductId <= 0)) {
          throw new Error("product_id must be a positive integer when provided");
        }
        if (explicitProductId !== null && !(await productExists(env, explicitProductId, productExistenceCache))) {
          throw new Error(`product_id ${explicitProductId} does not exist in products`);
        }

        let resolvedProductId: number | null = null;
        let resolvedScope = "unmapped";
        if (explicitProductId !== null) {
          resolvedProductId = explicitProductId;
          resolvedScope = "explicit_product_id";
        } else {
          const lookupKeys = [
            { key: `campaign_id:${campaignId}`, value: campaignId, scope: "alias_campaign_id" },
            { key: `ad_group_id:${adGroupId}`, value: adGroupId, scope: "alias_ad_group_id" },
            { key: `campaign_name:${campaignName}`, value: campaignName, scope: "alias_campaign_name" },
            { key: `ad_group_name:${adGroupName}`, value: adGroupName, scope: "alias_ad_group_name" },
          ];
          for (const lk of lookupKeys) {
            if (!lk.value) continue;
            if (!aliasCache.has(lk.key)) aliasCache.set(lk.key, await resolveAliasProduct(env, lk.value));
            const hit = aliasCache.get(lk.key)!;
            if (hit.productId) {
              resolvedProductId = hit.productId;
              resolvedScope = lk.scope;
              break;
            }
            if (hit.mappingScope === "alias_multi_product") {
              resolvedScope = "alias_multi_product";
            }
          }
        }

        const existing: any = await env.DB.prepare(
          `SELECT id, customer_name, campaign_name, ad_group_name, channel_type, network, device, currency,
                  impressions, clicks, cost, conversions, conversion_value, all_conversions, all_conversions_value,
                  product_id, mapping_scope
           FROM google_ads_campaign_daily
           WHERE report_date = ?1
             AND customer_id = ?2
             AND campaign_id = ?3
             AND ad_group_id = ?4
             AND network = ?5
             AND device = ?6
             AND currency = ?7
           LIMIT 1`
        )
          .bind(reportDate, customerId, campaignId, adGroupId, network, device, currency)
          .first();

        if (!existing) {
          await env.DB.prepare(
            `INSERT INTO google_ads_campaign_daily
             (report_date, customer_id, customer_name, campaign_id, campaign_name, ad_group_id, ad_group_name,
              channel_type, network, device, currency, impressions, clicks, cost, conversions, conversion_value,
              all_conversions, all_conversions_value, product_id, mapping_scope, source_updated_at)
             VALUES
             (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`
          )
            .bind(
              reportDate,
              customerId,
              customerName,
              campaignId,
              campaignName,
              adGroupId,
              adGroupName,
              channelType,
              network,
              device,
              currency,
              impressions,
              clicks,
              cost,
              conversions,
              conversionValue,
              allConversions,
              allConversionsValue,
              resolvedProductId,
              resolvedScope,
              nowIso
            )
            .run();
          created++;
          continue;
        }

        const noChange =
          sameNullable(existing.customer_name, customerName) &&
          sameNullable(existing.campaign_name, campaignName) &&
          sameNullable(existing.ad_group_name, adGroupName) &&
          sameNullable(existing.channel_type, channelType) &&
          sameNullable(existing.network, network) &&
          sameNullable(existing.device, device) &&
          sameNullable(existing.currency, currency) &&
          Number(existing.impressions || 0) === impressions &&
          Number(existing.clicks || 0) === clicks &&
          sameNullableNum(existing.cost, cost) &&
          sameNullableNum(existing.conversions, conversions) &&
          sameNullableNum(existing.conversion_value, conversionValue) &&
          sameNullableNum(existing.all_conversions, allConversions) &&
          sameNullableNum(existing.all_conversions_value, allConversionsValue) &&
          sameNullable(existing.product_id, resolvedProductId) &&
          sameNullable(existing.mapping_scope, resolvedScope);

        if (noChange) {
          unchanged++;
          continue;
        }

        await env.DB.prepare(
          `UPDATE google_ads_campaign_daily
           SET customer_name = ?1,
               campaign_name = ?2,
               ad_group_name = ?3,
               channel_type = ?4,
               impressions = ?5,
               clicks = ?6,
               cost = ?7,
               conversions = ?8,
               conversion_value = ?9,
               all_conversions = ?10,
               all_conversions_value = ?11,
               product_id = ?12,
               mapping_scope = ?13,
               source_updated_at = ?14,
               updated_at = ?15
           WHERE id = ?16`
        )
          .bind(
            customerName,
            campaignName,
            adGroupName,
            channelType,
            impressions,
            clicks,
            cost,
            conversions,
            conversionValue,
            allConversions,
            allConversionsValue,
            resolvedProductId,
            resolvedScope,
            nowIso,
            nowIso,
            existing.id
          )
          .run();
        updated++;
      } catch (rowErr: any) {
        rejected++;
        rejects.push({
          index: i,
          reason: String(rowErr?.message || rowErr).slice(0, 220),
        });
      }
    }

    const status = rejected === 0 ? "success" : created + updated > 0 ? "partial" : "failed";
    await finishSyncRun(env, runId, { status: status as any, created, updated, unchanged, rejected });
    return response({
      success: status !== "failed",
      run_id: runId,
      status,
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
        error_code: "GOOGLE_ADS_UPSERT_FAILED",
        message: String(e?.message || e),
        run_id: runId,
      },
      500
    );
  }
}

export async function handleGoogleAdsApi(request: Request, env: any): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method.toUpperCase();

  if (!path.startsWith("/v1/google-ads") && !path.startsWith("/api/v1/google-ads")) return null;
  if (method === "OPTIONS") return response({ ok: true });

  if (method === "GET" && (path === "/v1/google-ads/health" || path === "/api/v1/google-ads/health")) {
    return response({ ok: true, service: GOOGLE_ADS_SERVICE_NAME });
  }

  if (method === "POST" && (path === "/v1/google-ads/rows/upsert" || path === "/api/v1/google-ads/rows/upsert")) {
    return handleRowsUpsert(request, env);
  }

  return response({ success: false, error_code: "ROUTE_NOT_FOUND", message: "Google Ads route not found." }, 404);
}
