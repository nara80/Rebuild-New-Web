const SALES_SERVICE_NAME = "mildmate-sales-api";
const SALES_TOKEN_SECRET_NAME = "SALES_SYNC_API_TOKEN";

type AnyObj = Record<string, any>;

const SOURCE_MAP: Record<string, string> = {
  shopee: "shopee",
  lazada: "lazada",
  tiktok: "tiktok",
  line: "line",
  tline: "line",
  twhatsapp: "whatsapp",
  whatsapp: "whatsapp",
  etsy: "etsy",
  ebay: "ebay",
  facebook: "facebook",
  mildmate: "website",
  twebsite: "website",
  website: "website",
  manual: "manual",
};

const ALLOWED_STATUS = new Set([
  "pending",
  "paid",
  "processing",
  "shipped",
  "completed",
  "cancelled",
  "refunded",
  "archived",
]);

const ALLOWED_MAPPING_STATUS = new Set([
  "Mapped",
  "Partial",
  "Review Required",
  "Unmapped",
]);

const ALLOWED_REVENUE_STATUS = new Set(["EXACT", "UNALLOCATED"]);

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

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

function trimTo(v: any, max = 255): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function toNum(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeSourceSystem(raw: any): string {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  if (!key) return "";
  if (SOURCE_MAP[key]) return SOURCE_MAP[key];
  return key.replace(/[^a-z0-9-]/g, "");
}

function normalizeStatus(raw: any): string | null {
  const v = trimTo(raw, 40);
  if (!v) return null;
  const s = v.toLowerCase();
  if (!ALLOWED_STATUS.has(s)) return null;
  return s;
}

function normalizeMappingStatus(raw: any): string | null {
  const v = trimTo(raw, 40);
  if (!v) return null;
  return ALLOWED_MAPPING_STATUS.has(v) ? v : null;
}

function parseItemStatus(raw: any): string {
  const v = String(raw || "").trim().toLowerCase();
  return v === "removed" ? "removed" : "active";
}

function same(a: any, b: any): boolean {
  if (a === null || a === undefined || a === "") return b === null || b === undefined || b === "";
  if (b === null || b === undefined || b === "") return false;
  return String(a) === String(b);
}

async function ensureSalesSchema(env: any): Promise<void> {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const schemaSql = [
        `CREATE TABLE IF NOT EXISTS sales_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_system TEXT NOT NULL,
          source_order_id TEXT NOT NULL,
          notion_page_id TEXT,
          order_date TEXT,
          channel TEXT,
          currency TEXT,
          order_total REAL,
          status TEXT,
          destination_country TEXT,
          mapping_status TEXT,
          source_created_at TEXT,
          source_updated_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(source_system, source_order_id)
        )`,
        `CREATE TABLE IF NOT EXISTS sales_order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sales_order_id INTEGER NOT NULL,
          source_item_key TEXT NOT NULL,
          item_no INTEGER,
          product_id INTEGER,
          quantity REAL,
          raw_item_text TEXT,
          line_revenue REAL,
          revenue_status TEXT NOT NULL,
          mapping_status TEXT,
          item_status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
          FOREIGN KEY (product_id) REFERENCES products(id),
          UNIQUE(sales_order_id, source_item_key)
        )`,
        `CREATE TABLE IF NOT EXISTS sync_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          scenario TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          status TEXT NOT NULL,
          records_received INTEGER DEFAULT 0,
          records_created INTEGER DEFAULT 0,
          records_updated INTEGER DEFAULT 0,
          records_unchanged INTEGER DEFAULT 0,
          records_rejected INTEGER DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_sales_orders_order_date ON sales_orders(order_date)`,
        `CREATE INDEX IF NOT EXISTS idx_sales_orders_channel ON sales_orders(channel)`,
        `CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status)`,
        `CREATE INDEX IF NOT EXISTS idx_sales_orders_notion_page ON sales_orders(notion_page_id)`,
        `CREATE INDEX IF NOT EXISTS idx_sales_order_items_product ON sales_order_items(product_id)`,
        `CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(sales_order_id)`,
        `CREATE TABLE IF NOT EXISTS product_mapping_aliases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_system TEXT,
          listing_id TEXT,
          alias_text TEXT NOT NULL,
          alias_norm TEXT NOT NULL,
          product_ids TEXT NOT NULL,
          match_scope TEXT NOT NULL DEFAULT 'alias',
          verified INTEGER NOT NULL DEFAULT 0,
          hit_count INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_product_mapping_aliases_key
          ON product_mapping_aliases (COALESCE(source_system, ''), COALESCE(listing_id, ''), alias_norm)`,
        `CREATE INDEX IF NOT EXISTS idx_product_mapping_aliases_listing ON product_mapping_aliases(listing_id)`,
        `CREATE TABLE IF NOT EXISTS product_mapping_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notion_page_id TEXT,
          source_order_id TEXT,
          source_system TEXT,
          raw_product_text TEXT,
          previous_product_ids TEXT,
          resolved_product_ids TEXT,
          mapping_method TEXT,
          confidence REAL,
          result_status TEXT,
          dry_run INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_product_mapping_events_order ON product_mapping_events(source_order_id)`,
        `CREATE INDEX IF NOT EXISTS idx_product_mapping_events_page ON product_mapping_events(notion_page_id)`,
      ];
      for (const sql of schemaSql) {
        await env.DB.prepare(sql).run();
      }
      schemaReady = true;
    })().finally(() => {
      if (!schemaReady) schemaPromise = null;
    });
  }
  await schemaPromise;
}

async function createSyncRun(env: any, payload: AnyObj): Promise<number> {
  const startedAt = new Date().toISOString();
  const source = trimTo(payload.sync_source, 80) || "notion-orderlist";
  const scenario = trimTo(payload.scenario, 200);
  const ins = await env.DB.prepare(
    `INSERT INTO sync_runs (source, scenario, started_at, status, records_received)
     VALUES (?1, ?2, ?3, 'running', 1)`
  ).bind(source, scenario, startedAt).run();
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

async function requireBearerAuth(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const configured = trimTo(env[SALES_TOKEN_SECRET_NAME], 500);
  if (!configured) {
    return {
      ok: false,
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: `${SALES_TOKEN_SECRET_NAME} is not configured`,
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

async function validateProductIds(env: any, items: AnyObj[]): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const ids = Array.from(
    new Set(
      items
        .map((i) => (i.product_id === null || i.product_id === undefined ? null : Number(i.product_id)))
        .filter((v) => Number.isInteger(v) && (v as number) > 0)
    )
  ) as number[];

  if (ids.length === 0) return { ok: true };
  const placeholders = ids.map(() => "?").join(", ");
  const found = await env.DB.prepare(`SELECT id FROM products WHERE id IN (${placeholders})`).bind(...ids).all();
  const foundSet = new Set((found.results || []).map((r: any) => Number(r.id)));
  const missing = ids.find((id) => !foundSet.has(id));
  if (missing) {
    return { ok: false, code: "INVALID_PRODUCT_ID", message: `Product ID ${missing} does not exist.` };
  }
  return { ok: true };
}

function normalizePayload(raw: AnyObj): { ok: true; data: AnyObj } | { ok: false; code: string; message: string } {
  const sourceSystem = normalizeSourceSystem(raw.source_system);
  if (!sourceSystem) return { ok: false, code: "MISSING_SOURCE_SYSTEM", message: "source_system is required." };

  const sourceOrderId = trimTo(raw.source_order_id, 120);
  if (!sourceOrderId) return { ok: false, code: "MISSING_SOURCE_ORDER_ID", message: "source_order_id is required." };

  const currencyRaw = trimTo(raw.currency, 10);
  const currency = currencyRaw ? currencyRaw.toUpperCase() : null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, code: "INVALID_CURRENCY", message: "currency must be a 3-letter ISO code." };
  }

  const normalizedStatus = raw.status === undefined || raw.status === null || raw.status === ""
    ? null
    : normalizeStatus(raw.status);
  if (raw.status !== undefined && raw.status !== null && raw.status !== "" && !normalizedStatus) {
    return { ok: false, code: "INVALID_STATUS", message: "status is invalid." };
  }

  const mappingStatus = normalizeMappingStatus(raw.mapping_status);
  if (raw.mapping_status !== undefined && raw.mapping_status !== null && raw.mapping_status !== "" && !mappingStatus) {
    return { ok: false, code: "INVALID_MAPPING_STATUS", message: "mapping_status is invalid." };
  }

  const orderTotal = toNum(raw.order_total);
  if (raw.order_total !== undefined && raw.order_total !== null && raw.order_total !== "" && orderTotal === null) {
    return { ok: false, code: "INVALID_ORDER_TOTAL", message: "order_total must be numeric." };
  }

  const destinationCountryRaw = trimTo(raw.destination_country, 20);
  const destinationCountry = destinationCountryRaw ? destinationCountryRaw.toUpperCase() : null;
  if (destinationCountry && !/^[A-Z]{2,3}$/.test(destinationCountry)) {
    return { ok: false, code: "INVALID_DESTINATION_COUNTRY", message: "destination_country must be ISO country code." };
  }

  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  const seenKeys = new Set<string>();
  const items = itemsRaw.map((it: AnyObj, idx: number) => {
    const sourceItemKey = trimTo(it.source_item_key, 120) || `item-${idx + 1}`;
    if (seenKeys.has(sourceItemKey)) {
      throw new Error(`DUPLICATE_SOURCE_ITEM_KEY::${sourceItemKey}`);
    }
    seenKeys.add(sourceItemKey);

    const productId = it.product_id === undefined || it.product_id === null || it.product_id === ""
      ? null
      : Number(it.product_id);
    if (productId !== null && (!Number.isInteger(productId) || productId <= 0)) {
      throw new Error(`INVALID_PRODUCT_ID::${it.product_id}`);
    }

    const quantity = toNum(it.quantity);
    if (it.quantity !== undefined && it.quantity !== null && it.quantity !== "" && (quantity === null || quantity <= 0)) {
      throw new Error(`INVALID_QUANTITY::${it.quantity}`);
    }

    const revenueStatus = String(it.revenue_status || "").trim().toUpperCase();
    if (!ALLOWED_REVENUE_STATUS.has(revenueStatus)) {
      throw new Error(`INVALID_REVENUE_STATUS::${it.revenue_status}`);
    }

    const lineRevenue = toNum(it.line_revenue);
    if (revenueStatus === "EXACT" && lineRevenue === null) {
      throw new Error("MISSING_EXACT_REVENUE");
    }
    if (revenueStatus === "UNALLOCATED" && lineRevenue !== null) {
      throw new Error("UNALLOCATED_MUST_BE_NULL");
    }

    const itemMapping = normalizeMappingStatus(it.mapping_status);
    if (it.mapping_status !== undefined && it.mapping_status !== null && it.mapping_status !== "" && !itemMapping) {
      throw new Error(`INVALID_ITEM_MAPPING_STATUS::${it.mapping_status}`);
    }

    const itemNo = it.item_no === undefined || it.item_no === null || it.item_no === ""
      ? null
      : Number(it.item_no);
    if (itemNo !== null && (!Number.isInteger(itemNo) || itemNo <= 0)) {
      throw new Error(`INVALID_ITEM_NO::${it.item_no}`);
    }

    return {
      source_item_key: sourceItemKey,
      item_no: itemNo,
      product_id: productId,
      quantity,
      raw_item_text: trimTo(it.raw_item_text, 2000),
      line_revenue: revenueStatus === "UNALLOCATED" ? null : lineRevenue,
      revenue_status: revenueStatus,
      mapping_status: itemMapping,
      item_status: "active",
    };
  });

  return {
    ok: true,
    data: {
      source_system: sourceSystem,
      source_order_id: sourceOrderId,
      notion_page_id: trimTo(raw.notion_page_id, 120),
      order_date: trimTo(raw.order_date, 40),
      channel: trimTo(raw.channel, 120),
      currency,
      order_total: orderTotal,
      status: normalizedStatus,
      destination_country: destinationCountry,
      mapping_status: mappingStatus,
      source_created_at: trimTo(raw.source_created_at, 50),
      source_updated_at: trimTo(raw.source_updated_at, 50),
      items,
      sync_source: trimTo(raw.sync_source, 80),
      scenario: trimTo(raw.scenario, 200),
    },
  };
}

function compareOrder(existing: AnyObj, incoming: AnyObj): boolean {
  return (
    same(existing.notion_page_id, incoming.notion_page_id) &&
    same(existing.order_date, incoming.order_date) &&
    same(existing.channel, incoming.channel) &&
    same(existing.currency, incoming.currency) &&
    same(existing.order_total, incoming.order_total) &&
    same(existing.status, incoming.status) &&
    same(existing.destination_country, incoming.destination_country) &&
    same(existing.mapping_status, incoming.mapping_status) &&
    same(existing.source_created_at, incoming.source_created_at) &&
    same(existing.source_updated_at, incoming.source_updated_at)
  );
}

function compareItem(existing: AnyObj, incoming: AnyObj): boolean {
  return (
    same(existing.item_no, incoming.item_no) &&
    same(existing.product_id, incoming.product_id) &&
    same(existing.quantity, incoming.quantity) &&
    same(existing.raw_item_text, incoming.raw_item_text) &&
    same(existing.line_revenue, incoming.line_revenue) &&
    same(existing.revenue_status, incoming.revenue_status) &&
    same(existing.mapping_status, incoming.mapping_status) &&
    parseItemStatus(existing.item_status) === parseItemStatus(incoming.item_status)
  );
}

async function handleUpsert(request: Request, env: any): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({
      success: false,
      action: "rejected",
      error_code: auth.code,
      message: auth.message,
    }, auth.status);
  }

  let body: AnyObj;
  try {
    body = await request.json();
  } catch {
    return response({
      success: false,
      action: "rejected",
      error_code: "INVALID_JSON",
      message: "Request body must be valid JSON.",
    }, 400);
  }

  const normalized = normalizePayload(body);
  if (!normalized.ok) {
    return response({
      success: false,
      action: "rejected",
      error_code: normalized.code,
      message: normalized.message,
    }, 400);
  }

  const payload = normalized.data;
  const productCheck = await validateProductIds(env, payload.items || []);
  if (!productCheck.ok) {
    return response({
      success: false,
      action: "rejected",
      error_code: productCheck.code,
      message: productCheck.message,
    }, 400);
  }

  let syncRunId = 0;
  try {
    syncRunId = await createSyncRun(env, payload);

    const existingOrder = await env.DB.prepare(
      `SELECT id, notion_page_id, order_date, channel, currency, order_total, status,
              destination_country, mapping_status, source_created_at, source_updated_at
       FROM sales_orders
       WHERE source_system = ?1 AND source_order_id = ?2
       LIMIT 1`
    ).bind(payload.source_system, payload.source_order_id).first();

    let salesOrderId = 0;
    let orderAction: "created" | "updated" | "unchanged" = "unchanged";

    if (!existingOrder) {
      const inserted = await env.DB.prepare(
        `INSERT INTO sales_orders (
          source_system, source_order_id, notion_page_id, order_date, channel, currency, order_total,
          status, destination_country, mapping_status, source_created_at, source_updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
      ).bind(
        payload.source_system,
        payload.source_order_id,
        payload.notion_page_id,
        payload.order_date,
        payload.channel,
        payload.currency,
        payload.order_total,
        payload.status,
        payload.destination_country,
        payload.mapping_status,
        payload.source_created_at,
        payload.source_updated_at
      ).run();
      salesOrderId = Number(inserted.meta?.last_row_id || 0);
      orderAction = "created";
    } else {
      salesOrderId = Number(existingOrder.id);
      const sameOrder = compareOrder(existingOrder, payload);
      if (!sameOrder) {
        await env.DB.prepare(
          `UPDATE sales_orders
           SET notion_page_id = ?1,
               order_date = ?2,
               channel = ?3,
               currency = ?4,
               order_total = ?5,
               status = ?6,
               destination_country = ?7,
               mapping_status = ?8,
               source_created_at = ?9,
               source_updated_at = ?10,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?11`
        ).bind(
          payload.notion_page_id,
          payload.order_date,
          payload.channel,
          payload.currency,
          payload.order_total,
          payload.status,
          payload.destination_country,
          payload.mapping_status,
          payload.source_created_at,
          payload.source_updated_at,
          salesOrderId
        ).run();
        orderAction = "updated";
      }
    }

    const existingItemsRes = await env.DB.prepare(
      `SELECT id, source_item_key, item_no, product_id, quantity, raw_item_text, line_revenue,
              revenue_status, mapping_status, item_status
       FROM sales_order_items
       WHERE sales_order_id = ?1`
    ).bind(salesOrderId).all();

    const existingItems = (existingItemsRes.results || []) as AnyObj[];
    const existingMap = new Map<string, AnyObj>();
    existingItems.forEach((row) => existingMap.set(String(row.source_item_key), row));

    const incomingKeys = new Set<string>();
    const itemStats = { created: 0, updated: 0, unchanged: 0, removed: 0 };

    for (const item of payload.items) {
      const k = String(item.source_item_key);
      incomingKeys.add(k);
      const prev = existingMap.get(k);
      if (!prev) {
        await env.DB.prepare(
          `INSERT INTO sales_order_items (
            sales_order_id, source_item_key, item_no, product_id, quantity, raw_item_text,
            line_revenue, revenue_status, mapping_status, item_status
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'active')`
        ).bind(
          salesOrderId,
          item.source_item_key,
          item.item_no,
          item.product_id,
          item.quantity,
          item.raw_item_text,
          item.line_revenue,
          item.revenue_status,
          item.mapping_status
        ).run();
        itemStats.created += 1;
        continue;
      }

      const merged = { ...item, item_status: "active" };
      const unchanged = compareItem(prev, merged);
      if (unchanged) {
        itemStats.unchanged += 1;
      } else {
        await env.DB.prepare(
          `UPDATE sales_order_items
           SET item_no = ?1,
               product_id = ?2,
               quantity = ?3,
               raw_item_text = ?4,
               line_revenue = ?5,
               revenue_status = ?6,
               mapping_status = ?7,
               item_status = 'active',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?8`
        ).bind(
          item.item_no,
          item.product_id,
          item.quantity,
          item.raw_item_text,
          item.line_revenue,
          item.revenue_status,
          item.mapping_status,
          prev.id
        ).run();
        itemStats.updated += 1;
      }
    }

    for (const prev of existingItems) {
      const k = String(prev.source_item_key);
      if (!incomingKeys.has(k) && parseItemStatus(prev.item_status) !== "removed") {
        await env.DB.prepare(
          `UPDATE sales_order_items
           SET item_status = 'removed', updated_at = CURRENT_TIMESTAMP
           WHERE id = ?1`
        ).bind(prev.id).run();
        itemStats.removed += 1;
      }
    }

    let action: "created" | "updated" | "unchanged" = "unchanged";
    if (orderAction === "created") action = "created";
    else if (
      orderAction === "updated" ||
      itemStats.created > 0 ||
      itemStats.updated > 0 ||
      itemStats.removed > 0
    ) action = "updated";

    await finishSyncRun(env, syncRunId, {
      status: "success",
      created: action === "created" ? 1 : 0,
      updated: action === "updated" ? 1 : 0,
      unchanged: action === "unchanged" ? 1 : 0,
      rejected: 0,
    });

    return response({
      success: true,
      action,
      sales_order_id: salesOrderId,
      source_system: payload.source_system,
      source_order_id: payload.source_order_id,
      items: itemStats,
    });
  } catch (e: any) {
    const msg = String(e?.message || e || "Unexpected error");
    const upper = msg.toUpperCase();
    let code = "UPSERT_FAILED";
    let http = 500;
    if (upper.startsWith("DUPLICATE_SOURCE_ITEM_KEY::")) {
      code = "DUPLICATE_SOURCE_ITEM_KEY";
      http = 400;
    } else if (upper.startsWith("INVALID_PRODUCT_ID::")) {
      code = "INVALID_PRODUCT_ID";
      http = 400;
    } else if (upper.startsWith("INVALID_QUANTITY::")) {
      code = "INVALID_QUANTITY";
      http = 400;
    } else if (upper.startsWith("INVALID_REVENUE_STATUS::")) {
      code = "INVALID_REVENUE_STATUS";
      http = 400;
    } else if (upper.startsWith("INVALID_ITEM_MAPPING_STATUS::")) {
      code = "INVALID_MAPPING_STATUS";
      http = 400;
    } else if (upper === "MISSING_EXACT_REVENUE") {
      code = "MISSING_EXACT_REVENUE";
      http = 400;
    } else if (upper === "UNALLOCATED_MUST_BE_NULL") {
      code = "UNALLOCATED_REVENUE_MUST_BE_NULL";
      http = 400;
    } else if (upper.startsWith("INVALID_ITEM_NO::")) {
      code = "INVALID_ITEM_NO";
      http = 400;
    }

    await finishSyncRun(env, syncRunId, {
      status: "failed",
      rejected: 1,
      error: msg,
    });

    return response({
      success: false,
      action: "rejected",
      error_code: code,
      message: msg,
    }, http);
  }
}

async function handleReadOrder(request: Request, env: any, sourcePart: string, orderPart: string): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({
      success: false,
      action: "rejected",
      error_code: auth.code,
      message: auth.message,
    }, auth.status);
  }

  const source = normalizeSourceSystem(decodeURIComponent(sourcePart || ""));
  const sourceOrderId = decodeURIComponent(orderPart || "").trim();
  if (!source || !sourceOrderId) {
    return response({
      success: false,
      action: "rejected",
      error_code: "INVALID_PATH_PARAMS",
      message: "source_system and source_order_id are required.",
    }, 400);
  }

  const order = await env.DB.prepare(
    `SELECT id, source_system, source_order_id, notion_page_id, order_date, channel, currency,
            order_total, status, destination_country, mapping_status, source_created_at, source_updated_at,
            created_at, updated_at
     FROM sales_orders
     WHERE source_system = ?1 AND source_order_id = ?2
     LIMIT 1`
  ).bind(source, sourceOrderId).first();

  if (!order) {
    return response({
      success: false,
      action: "rejected",
      error_code: "ORDER_NOT_FOUND",
      message: "Order not found.",
    }, 404);
  }

  const items = await env.DB.prepare(
    `SELECT id, source_item_key, item_no, product_id, quantity, raw_item_text, line_revenue,
            revenue_status, mapping_status, item_status, created_at, updated_at
     FROM sales_order_items
     WHERE sales_order_id = ?1
     ORDER BY id`
  ).bind((order as AnyObj).id).all();

  return response({
    success: true,
    order,
    items: items.results || [],
  });
}

// ── Product mapping endpoints (Phase 07) ──────────────────────────────────
// Controlled endpoints for the Make.com "Notion Order Product Mapper":
// catalog read, deterministic resolve, and human-correction memory writes.

const ALLOWED_MATCH_SCOPE = new Set(["variation", "listing", "alias"]);

function normalizeAliasKey(raw: any): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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

async function handleMappingCatalog(request: Request, env: any): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({ success: false, error_code: auth.code, message: auth.message }, auth.status);
  }
  const rows = await env.DB.prepare(
    `SELECT id, slug, title_en, product_type, is_active
     FROM products
     WHERE is_active = 1
     ORDER BY id`
  ).all();
  return response({
    success: true,
    count: (rows.results || []).length,
    note: "Approved canonical Product_ID catalog. AI fallback must only choose ids from this list; never invent a Product_ID.",
    products: rows.results || [],
  });
}

async function recordAliasHit(env: any, aliasId: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE product_mapping_aliases
     SET hit_count = hit_count + 1, last_used_at = ?1
     WHERE id = ?2`
  ).bind(new Date().toISOString(), aliasId).run();
}

async function handleMappingResolve(request: Request, env: any): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({ success: false, error_code: auth.code, message: auth.message }, auth.status);
  }

  let body: AnyObj;
  try {
    body = await request.json();
  } catch {
    return response({ success: false, error_code: "INVALID_JSON", message: "Body must be valid JSON." }, 400);
  }

  const source = normalizeSourceSystem(body.source_system) || null;
  const listingId = trimTo(body.listing_id, 120);
  const variationNorm = normalizeAliasKey(body.variation_text);
  const itemNorm = normalizeAliasKey(body.item_text);

  if (!listingId && !variationNorm && !itemNorm) {
    return response({
      success: false,
      error_code: "MISSING_RESOLVE_INPUT",
      message: "Provide at least one of listing_id, variation_text, item_text.",
    }, 400);
  }

  // Source-specific rows outrank source-agnostic rows; verified rows outrank unverified.
  const order = `ORDER BY (source_system IS NULL) ASC, verified DESC, id ASC LIMIT 1`;
  const sourceCond = `(source_system IS NULL OR source_system = ?1)`;

  const hit = async (sql: string, ...binds: any[]) =>
    env.DB.prepare(sql).bind(...binds).first();

  let row: AnyObj | null = null;
  let method = "";

  // 1. Exact marketplace variation under the specific listing (variation outranks parent listing title).
  if (!row && listingId && variationNorm) {
    row = await hit(
      `SELECT * FROM product_mapping_aliases
       WHERE match_scope = 'variation' AND listing_id = ?2 AND alias_norm = ?3 AND ${sourceCond} ${order}`,
      source, listingId, variationNorm
    );
    if (row) method = "variation_exact";
  }

  // 2. Exact verified alias (variation text first, then raw item text).
  for (const norm of [variationNorm, itemNorm]) {
    if (row || !norm) continue;
    row = await hit(
      `SELECT * FROM product_mapping_aliases
       WHERE verified = 1 AND alias_norm = ?2 AND ${sourceCond} ${order}`,
      source, norm
    );
    if (row) method = "verified_alias";
  }

  // 3. Listing-level mapping (only safe when the listing maps deterministically).
  if (!row && listingId) {
    row = await hit(
      `SELECT * FROM product_mapping_aliases
       WHERE match_scope = 'listing'
         AND (listing_id = ?2 OR alias_norm = ?3)
         AND ${sourceCond} ${order}`,
      source, listingId, normalizeAliasKey(listingId)
    );
    if (row) method = "listing";
  }

  if (!row) {
    return response({
      success: true,
      resolved: false,
      mapping_status_suggestion: "Review Required",
      message: "No deterministic mapping found. Do not guess; route to Review Required (AI fallback may only propose ids from /v1/mapping/catalog).",
    });
  }

  const productIds = parseProductIdsJson(row.product_ids);
  if (productIds.length === 0) {
    return response({
      success: true,
      resolved: false,
      mapping_status_suggestion: "Review Required",
      message: `Alias ${row.id} matched but stores no valid product ids; route to Review Required.`,
    });
  }

  await recordAliasHit(env, Number(row.id));

  return response({
    success: true,
    resolved: true,
    method,
    confidence: method === "listing" ? "medium" : "high",
    product_ids: productIds,
    mapping_status_suggestion: "Mapped",
    alias_id: Number(row.id),
    verified: Number(row.verified) === 1,
  });
}

async function handleMappingAliasUpsert(request: Request, env: any): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({ success: false, error_code: auth.code, message: auth.message }, auth.status);
  }

  let body: AnyObj;
  try {
    body = await request.json();
  } catch {
    return response({ success: false, error_code: "INVALID_JSON", message: "Body must be valid JSON." }, 400);
  }

  const source = normalizeSourceSystem(body.source_system) || null;
  const listingId = trimTo(body.listing_id, 120);
  const aliasText = trimTo(body.alias_text, 500) || listingId;
  if (!aliasText) {
    return response({ success: false, error_code: "MISSING_ALIAS_TEXT", message: "alias_text (or listing_id) is required." }, 400);
  }
  const aliasNorm = normalizeAliasKey(aliasText);
  if (!aliasNorm) {
    return response({ success: false, error_code: "INVALID_ALIAS_TEXT", message: "alias_text normalizes to empty." }, 400);
  }

  const rawIds = Array.isArray(body.product_ids) ? body.product_ids : [];
  const productIds = Array.from(new Set(rawIds.map((v: any) => Number(v))));
  if (productIds.length === 0 || productIds.some((v) => !Number.isInteger(v) || v <= 0)) {
    return response({ success: false, error_code: "INVALID_PRODUCT_IDS", message: "product_ids must be a non-empty array of positive integers." }, 400);
  }
  const check = await validateProductIds(env, productIds.map((id) => ({ product_id: id })));
  if (!check.ok) {
    return response({ success: false, error_code: check.code, message: check.message }, 400);
  }

  const scopeRaw = String(body.match_scope || "alias").toLowerCase();
  if (!ALLOWED_MATCH_SCOPE.has(scopeRaw)) {
    return response({ success: false, error_code: "INVALID_MATCH_SCOPE", message: "match_scope must be variation, listing, or alias." }, 400);
  }
  if (scopeRaw === "variation" && !listingId) {
    return response({ success: false, error_code: "MISSING_LISTING_ID", message: "match_scope=variation requires listing_id." }, 400);
  }

  const verified = body.verified === false ? 0 : 1; // human corrections default to verified
  const notes = trimTo(body.notes, 500);
  const now = new Date().toISOString();
  const idsJson = JSON.stringify(productIds);

  const existing: AnyObj | null = await env.DB.prepare(
    `SELECT id FROM product_mapping_aliases
     WHERE COALESCE(source_system, '') = COALESCE(?1, '')
       AND COALESCE(listing_id, '') = COALESCE(?2, '')
       AND alias_norm = ?3
     LIMIT 1`
  ).bind(source, listingId, aliasNorm).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE product_mapping_aliases
       SET alias_text = ?1, product_ids = ?2, match_scope = ?3, verified = ?4, notes = COALESCE(?5, notes), updated_at = ?6
       WHERE id = ?7`
    ).bind(aliasText, idsJson, scopeRaw, verified, notes, now, existing.id).run();
    return response({ success: true, action: "updated", alias_id: Number(existing.id), product_ids: productIds });
  }

  const ins = await env.DB.prepare(
    `INSERT INTO product_mapping_aliases
       (source_system, listing_id, alias_text, alias_norm, product_ids, match_scope, verified, notes, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`
  ).bind(source, listingId, aliasText, aliasNorm, idsJson, scopeRaw, verified, notes, now).run();

  return response({ success: true, action: "created", alias_id: Number(ins.meta?.last_row_id || 0), product_ids: productIds });
}

async function handleMappingAliasList(request: Request, env: any): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({ success: false, error_code: auth.code, message: auth.message }, auth.status);
  }
  const rows = await env.DB.prepare(
    `SELECT id, source_system, listing_id, alias_text, alias_norm, product_ids, match_scope,
            verified, hit_count, last_used_at, notes, created_at, updated_at
     FROM product_mapping_aliases
     ORDER BY updated_at DESC
     LIMIT 500`
  ).all();
  return response({ success: true, count: (rows.results || []).length, aliases: rows.results || [] });
}

const ALLOWED_MAPPING_METHOD = new Set(["EXACT_VARIATION", "EXACT_ALIAS", "LISTING_VARIATION", "RULE", "AI", "HUMAN"]);
const ALLOWED_RESULT_STATUS = new Set(["Mapped", "Partial", "Review Required", "Unmapped"]);

async function handleMappingEventInsert(request: Request, env: any): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({ success: false, error_code: auth.code, message: auth.message }, auth.status);
  }

  let body: AnyObj;
  try {
    body = await request.json();
  } catch {
    return response({ success: false, error_code: "INVALID_JSON", message: "Body must be valid JSON." }, 400);
  }

  const resultStatus = trimTo(body.result_status, 40);
  if (!resultStatus || !ALLOWED_RESULT_STATUS.has(resultStatus)) {
    return response({ success: false, error_code: "INVALID_RESULT_STATUS", message: "result_status must be one of: " + Array.from(ALLOWED_RESULT_STATUS).join(", ") }, 400);
  }
  const method = trimTo(body.mapping_method, 40);
  if (method && !ALLOWED_MAPPING_METHOD.has(method)) {
    return response({ success: false, error_code: "INVALID_MAPPING_METHOD", message: "mapping_method must be one of: " + Array.from(ALLOWED_MAPPING_METHOD).join(", ") }, 400);
  }
  let resolvedIds: string | null = null;
  if (body.resolved_product_ids !== undefined && body.resolved_product_ids !== null) {
    if (!Array.isArray(body.resolved_product_ids) || body.resolved_product_ids.some((v: any) => !Number.isInteger(Number(v)) || Number(v) <= 0)) {
      return response({ success: false, error_code: "INVALID_PRODUCT_IDS", message: "resolved_product_ids must be an array of positive integers." }, 400);
    }
    resolvedIds = JSON.stringify(body.resolved_product_ids.map((v: any) => Number(v)));
  }
  const confidence = toNum(body.confidence);

  const ins = await env.DB.prepare(
    `INSERT INTO product_mapping_events
       (notion_page_id, source_order_id, source_system, raw_product_text, previous_product_ids,
        resolved_product_ids, mapping_method, confidence, result_status, dry_run)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
  ).bind(
    trimTo(body.notion_page_id, 100),
    trimTo(body.source_order_id, 120),
    normalizeSourceSystem(body.source_system) || null,
    trimTo(body.raw_product_text, 1000),
    trimTo(body.previous_product_ids, 200),
    resolvedIds,
    method,
    confidence,
    resultStatus,
    body.dry_run ? 1 : 0
  ).run();

  return response({ success: true, action: "created", event_id: Number(ins.meta?.last_row_id || 0) });
}

async function handleMappingEventList(request: Request, env: any, url: URL): Promise<Response> {
  const auth = await requireBearerAuth(request, env);
  if (!auth.ok) {
    return response({ success: false, error_code: auth.code, message: auth.message }, auth.status);
  }
  const limitRaw = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 500 ? limitRaw : 100;
  const orderId = trimTo(url.searchParams.get("source_order_id"), 120);
  const rows = orderId
    ? await env.DB.prepare(
        `SELECT * FROM product_mapping_events WHERE source_order_id = ?1 ORDER BY id DESC LIMIT ?2`
      ).bind(orderId, limit).all()
    : await env.DB.prepare(
        `SELECT * FROM product_mapping_events ORDER BY id DESC LIMIT ?1`
      ).bind(limit).all();
  return response({ success: true, count: (rows.results || []).length, events: rows.results || [] });
}

export async function handleSalesApi(request: Request, env: any): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = request.method.toUpperCase();

  if (!path.startsWith("/v1") && !path.startsWith("/api/v1")) {
    return null;
  }

  await ensureSalesSchema(env);

  if (method === "OPTIONS") return response({ ok: true });

  if (method === "GET" && (path === "/v1/health" || path === "/api/v1/health")) {
    return response({ ok: true, service: SALES_SERVICE_NAME });
  }

  if (method === "POST" && (path === "/v1/sales/orders/upsert" || path === "/api/v1/sales/orders/upsert")) {
    return handleUpsert(request, env);
  }

  const readMatch = path.match(/^\/(?:api\/)?v1\/sales\/orders\/([^\/]+)\/([^\/]+)$/i);
  if (method === "GET" && readMatch) {
    return handleReadOrder(request, env, readMatch[1], readMatch[2]);
  }

  const mappingMatch = path.match(/^\/(?:api\/)?v1\/mapping\/(catalog|resolve|aliases|events)$/i);
  if (mappingMatch) {
    const sub = mappingMatch[1].toLowerCase();
    if (sub === "catalog" && method === "GET") return handleMappingCatalog(request, env);
    if (sub === "resolve" && method === "POST") return handleMappingResolve(request, env);
    if (sub === "aliases" && method === "POST") return handleMappingAliasUpsert(request, env);
    if (sub === "aliases" && method === "GET") return handleMappingAliasList(request, env);
    if (sub === "events" && method === "POST") return handleMappingEventInsert(request, env);
    if (sub === "events" && method === "GET") return handleMappingEventList(request, env, url);
  }

  return response({ error: "Sales route not found" }, 404);
}
