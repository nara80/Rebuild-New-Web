export type AttributionStage = "quote" | "checkout";

export type AttributionConsentState = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number | null;
  captured_at: string;
  source: string | null;
};

export type AttributionTouch = {
  source: string | null;
  medium: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  referrer_domain: string | null;
  referrer_path: string | null;
  landing_path: string | null;
  ga_client_id: string | null;
  ga_session_id: string | null;
  observed: boolean;
  inferred: boolean;
  captured_at: string;
};

export type SanitizedAttributionPayload = {
  schema_version: number;
  consent_state: AttributionConsentState;
  first_touch: AttributionTouch | null;
  quote_session: AttributionTouch | null;
  checkout_session: AttributionTouch | null;
};

const ATTRIBUTION_SCHEMA_VERSION = 1;

function cleanString(raw: any, max = 160): string | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  return v.slice(0, max);
}

function lowerToken(raw: any, max = 120): string | null {
  const clean = cleanString(raw, max);
  return clean ? clean.toLowerCase() : null;
}

function boolish(raw: any): boolean {
  return raw === true || raw === 1 || String(raw || "").toLowerCase() === "true";
}

function toIso(raw: any): string {
  const d = raw ? new Date(String(raw)) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function parseHost(raw: any): string | null {
  const input = cleanString(raw, 300);
  if (!input) return null;
  try {
    if (/^https?:\/\//i.test(input)) {
      return new URL(input).hostname.toLowerCase().slice(0, 200);
    }
  } catch {}
  const host = input.replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].split("#")[0].trim().toLowerCase();
  if (!host) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  return host.slice(0, 200);
}

function sanitizePath(raw: any): string | null {
  const input = cleanString(raw, 500);
  if (!input) return null;
  let path = input;
  try {
    if (/^https?:\/\//i.test(input)) {
      path = new URL(input).pathname || "/";
    }
  } catch {}
  path = path.split("?")[0].split("#")[0].trim();
  if (!path) return null;
  if (!path.startsWith("/")) path = "/" + path;
  path = path.replace(/\/{2,}/g, "/");
  if (/^\/quote\/qt-[^/]+\/?$/i.test(path)) return "/quote/";
  return path.slice(0, 240);
}

function sanitizeTouch(
  raw: any,
  consent: { analytics: boolean; marketing: boolean }
): AttributionTouch | null {
  if (!raw || typeof raw !== "object") return null;

  const utmSource = lowerToken(raw.utm_source || raw.source, 100);
  const utmMedium = lowerToken(raw.utm_medium || raw.medium, 100);
  const source = lowerToken(raw.source || raw.utm_source, 100);
  const medium = lowerToken(raw.medium || raw.utm_medium, 100);
  const utmCampaign = cleanString(raw.utm_campaign || raw.campaign, 140);
  const utmTerm = cleanString(raw.utm_term || raw.term, 140);
  const utmContent = cleanString(raw.utm_content || raw.content, 140);
  const gclid = consent.marketing ? cleanString(raw.gclid, 120) : null;
  const gbraid = consent.marketing ? cleanString(raw.gbraid, 120) : null;
  const wbraid = consent.marketing ? cleanString(raw.wbraid, 120) : null;
  const referrerDomain = parseHost(raw.referrer_domain || raw.referrer_host || raw.referrer);
  const referrerPath = sanitizePath(raw.referrer_path);
  const landingPath = sanitizePath(raw.landing_path || raw.path);
  const gaClientId = consent.analytics ? cleanString(raw.ga_client_id, 120) : null;
  const gaSessionId = consent.analytics ? cleanString(raw.ga_session_id, 120) : null;
  const observed = boolish(raw.observed) || !!(utmSource || utmMedium || gclid || gbraid || wbraid);
  const inferred = boolish(raw.inferred) || (!observed && !!(source || medium || referrerDomain));

  if (
    !source && !medium &&
    !utmSource && !utmMedium && !utmCampaign && !utmTerm && !utmContent &&
    !gclid && !gbraid && !wbraid &&
    !referrerDomain && !referrerPath && !landingPath &&
    !gaClientId && !gaSessionId
  ) {
    return null;
  }

  return {
    source: source || null,
    medium: medium || null,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    utm_term: utmTerm || null,
    utm_content: utmContent || null,
    gclid,
    gbraid,
    wbraid,
    referrer_domain: referrerDomain || null,
    referrer_path: referrerPath || null,
    landing_path: landingPath || null,
    ga_client_id: gaClientId,
    ga_session_id: gaSessionId,
    observed,
    inferred,
    captured_at: toIso(raw.captured_at),
  };
}

function sanitizeConsentState(raw: any): AttributionConsentState {
  const src = raw && typeof raw === "object" ? raw : {};
  const analytics = boolish(src.analytics);
  const marketing = boolish(src.marketing);
  const timestampNum = Number(src.timestamp);
  return {
    essential: true,
    analytics,
    marketing,
    timestamp: Number.isFinite(timestampNum) && timestampNum > 0 ? Math.round(timestampNum) : null,
    captured_at: toIso(src.captured_at),
    source: cleanString(src.source, 80),
  };
}

function safeParseObject(raw: any): any {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function toJsonText(value: any): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function sanitizeAttributionPayload(raw: any, stage: AttributionStage): SanitizedAttributionPayload {
  const parsed = safeParseObject(raw) || {};
  const consent = sanitizeConsentState(parsed.consent_state || parsed.consent || {});
  const firstTouch = sanitizeTouch(parsed.first_touch, consent) || null;
  const quoteTouch = stage === "quote" ? sanitizeTouch(parsed.quote_session || parsed.session_touch || parsed.latest_touch, consent) : null;
  const checkoutTouch = stage === "checkout" ? sanitizeTouch(parsed.checkout_session || parsed.session_touch || parsed.latest_touch, consent) : null;
  return {
    schema_version: ATTRIBUTION_SCHEMA_VERSION,
    consent_state: consent,
    first_touch: firstTouch,
    quote_session: quoteTouch,
    checkout_session: checkoutTouch,
  };
}

let quoteAttributionSchemaReady = false;
let quoteAttributionSchemaPromise: Promise<boolean> | null = null;

async function ensureQuoteAttributionSchema(env: any): Promise<boolean> {
  if (quoteAttributionSchemaReady) return true;
  if (!quoteAttributionSchemaPromise) {
    quoteAttributionSchemaPromise = (async () => {
      try {
        await env.DB.prepare(
          `CREATE TABLE IF NOT EXISTS quote_acquisition_attribution (
             quote_id TEXT PRIMARY KEY,
             email TEXT,
             schema_version INTEGER NOT NULL DEFAULT 1,
             first_touch_json TEXT,
             quote_session_json TEXT,
             checkout_session_json TEXT,
             consent_state_json TEXT,
             quote_session_captured_at DATETIME,
             checkout_session_captured_at DATETIME,
             checkout_stripe_session_id TEXT,
             created_at DATETIME DEFAULT (datetime('now')),
             updated_at DATETIME DEFAULT (datetime('now'))
           )`
        ).run();
        await env.DB.prepare(
          "CREATE INDEX IF NOT EXISTS idx_quote_acquisition_attr_email ON quote_acquisition_attribution(email)"
        ).run();
        await env.DB.prepare(
          "CREATE INDEX IF NOT EXISTS idx_quote_acquisition_attr_checkout_session ON quote_acquisition_attribution(checkout_stripe_session_id)"
        ).run();

        try {
          const tableInfo = await env.DB.prepare("PRAGMA table_info(quote_acquisition_attribution)").all();
          const existing = new Set((tableInfo?.results || []).map((r: any) => String(r?.name || "").toLowerCase()));
          const alters: string[] = [];
          if (!existing.has("schema_version")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1");
          if (!existing.has("first_touch_json")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN first_touch_json TEXT");
          if (!existing.has("quote_session_json")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN quote_session_json TEXT");
          if (!existing.has("checkout_session_json")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN checkout_session_json TEXT");
          if (!existing.has("consent_state_json")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN consent_state_json TEXT");
          if (!existing.has("quote_session_captured_at")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN quote_session_captured_at DATETIME");
          if (!existing.has("checkout_session_captured_at")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN checkout_session_captured_at DATETIME");
          if (!existing.has("checkout_stripe_session_id")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN checkout_stripe_session_id TEXT");
          if (!existing.has("updated_at")) alters.push("ALTER TABLE quote_acquisition_attribution ADD COLUMN updated_at DATETIME");
          for (const sql of alters) await env.DB.prepare(sql).run();
        } catch {}

        quoteAttributionSchemaReady = true;
        return true;
      } catch (e: any) {
        console.error("quote attribution schema init failed:", e?.message || e);
        return false;
      }
    })().finally(() => {
      if (!quoteAttributionSchemaReady) quoteAttributionSchemaPromise = null;
    });
  }
  return await quoteAttributionSchemaPromise;
}

function uniqueQuoteIds(rawIds: any[]): string[] {
  const out = new Set<string>();
  for (const raw of rawIds || []) {
    const id = cleanString(raw, 80);
    if (id) out.add(id);
  }
  return Array.from(out);
}

export function extractUniqueQuoteIdsFromItems(items: any[]): string[] {
  const ids: any[] = [];
  for (const item of Array.isArray(items) ? items : []) {
    ids.push((item as any)?.quote_id);
    ids.push((item as any)?.qi);
  }
  return uniqueQuoteIds(ids);
}

export async function upsertQuoteAttributionFromQuote(
  env: any,
  quoteIdRaw: any,
  emailRaw: any,
  payload: SanitizedAttributionPayload
): Promise<boolean> {
  const quoteId = cleanString(quoteIdRaw, 80);
  if (!quoteId) return false;
  const schemaOk = await ensureQuoteAttributionSchema(env);
  if (!schemaOk) return false;

  const email = lowerToken(emailRaw, 200);
  const firstTouchJson = toJsonText(payload?.first_touch);
  const quoteSessionJson = toJsonText(payload?.quote_session);
  const consentJson = toJsonText(payload?.consent_state);
  const quoteCapturedAt = payload?.quote_session?.captured_at || null;

  await env.DB.prepare(
    `INSERT INTO quote_acquisition_attribution (
       quote_id, email, schema_version, first_touch_json, quote_session_json, checkout_session_json,
       consent_state_json, quote_session_captured_at, checkout_session_captured_at, checkout_stripe_session_id,
       created_at, updated_at
     ) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7, NULL, NULL, datetime('now'), datetime('now'))
     ON CONFLICT(quote_id) DO UPDATE SET
       email = COALESCE(excluded.email, quote_acquisition_attribution.email),
       schema_version = excluded.schema_version,
       first_touch_json = COALESCE(quote_acquisition_attribution.first_touch_json, excluded.first_touch_json),
       quote_session_json = COALESCE(excluded.quote_session_json, quote_acquisition_attribution.quote_session_json),
       consent_state_json = COALESCE(excluded.consent_state_json, quote_acquisition_attribution.consent_state_json),
       quote_session_captured_at = COALESCE(excluded.quote_session_captured_at, quote_acquisition_attribution.quote_session_captured_at),
       updated_at = datetime('now')`
  ).bind(
    quoteId,
    email,
    Number(payload?.schema_version || ATTRIBUTION_SCHEMA_VERSION),
    firstTouchJson,
    quoteSessionJson,
    consentJson,
    quoteCapturedAt
  ).run();

  return true;
}

export async function upsertQuoteAttributionFromCheckout(
  env: any,
  quoteIdsRaw: any[],
  emailRaw: any,
  payload: SanitizedAttributionPayload,
  stripeSessionIdRaw?: any
): Promise<boolean> {
  const quoteIds = uniqueQuoteIds(quoteIdsRaw || []);
  if (quoteIds.length === 0) return false;
  const schemaOk = await ensureQuoteAttributionSchema(env);
  if (!schemaOk) return false;

  const email = lowerToken(emailRaw, 200);
  const firstTouchJson = toJsonText(payload?.first_touch);
  const checkoutSessionJson = toJsonText(payload?.checkout_session);
  const consentJson = toJsonText(payload?.consent_state);
  const checkoutCapturedAt = payload?.checkout_session?.captured_at || null;
  const stripeSessionId = cleanString(stripeSessionIdRaw, 120);

  for (const quoteId of quoteIds) {
    await env.DB.prepare(
      `INSERT INTO quote_acquisition_attribution (
         quote_id, email, schema_version, first_touch_json, quote_session_json, checkout_session_json,
         consent_state_json, quote_session_captured_at, checkout_session_captured_at, checkout_stripe_session_id,
         created_at, updated_at
       ) VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?6, NULL, ?7, ?8, datetime('now'), datetime('now'))
       ON CONFLICT(quote_id) DO UPDATE SET
         email = COALESCE(excluded.email, quote_acquisition_attribution.email),
         schema_version = excluded.schema_version,
         first_touch_json = COALESCE(quote_acquisition_attribution.first_touch_json, excluded.first_touch_json),
         checkout_session_json = COALESCE(excluded.checkout_session_json, quote_acquisition_attribution.checkout_session_json),
         consent_state_json = COALESCE(excluded.consent_state_json, quote_acquisition_attribution.consent_state_json),
         checkout_session_captured_at = COALESCE(excluded.checkout_session_captured_at, quote_acquisition_attribution.checkout_session_captured_at),
         checkout_stripe_session_id = COALESCE(excluded.checkout_stripe_session_id, quote_acquisition_attribution.checkout_stripe_session_id),
         updated_at = datetime('now')`
    ).bind(
      quoteId,
      email,
      Number(payload?.schema_version || ATTRIBUTION_SCHEMA_VERSION),
      firstTouchJson,
      checkoutSessionJson,
      consentJson,
      checkoutCapturedAt,
      stripeSessionId
    ).run();
  }

  return true;
}
