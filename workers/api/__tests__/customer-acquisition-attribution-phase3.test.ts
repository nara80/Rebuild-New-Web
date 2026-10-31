import { describe, it, expect, beforeEach } from "vitest";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import {
  extractUniqueQuoteIdsFromItems,
  sanitizeAttributionPayload,
  upsertQuoteAttributionFromCheckout,
  upsertQuoteAttributionFromQuote,
} from "../attribution";

const ROOT = "D:/00_mildmate/re-build_web";

class AttrDb {
  rows = new Map<string, any>();
  prepare(sql: string) {
    return new AttrStmt(this, sql);
  }
}

class AttrStmt {
  private args: any[] = [];
  constructor(private db: AttrDb, private sqlRaw: string) {}
  bind(...args: any[]) { this.args = args; return this; }
  async run() { return exec(this.db, this.sqlRaw, this.args, "run"); }
  async first() { return exec(this.db, this.sqlRaw, this.args, "first"); }
  async all() { return exec(this.db, this.sqlRaw, this.args, "all"); }
}

function norm(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function exec(db: AttrDb, sqlRaw: string, args: any[], mode: "run" | "first" | "all") {
  const sql = norm(sqlRaw);
  if (sql.startsWith("create table if not exists")) return { success: true, meta: { changes: 1 } };
  if (sql.startsWith("create index if not exists")) return { success: true, meta: { changes: 1 } };
  if (sql.startsWith("alter table quote_acquisition_attribution")) return { success: true, meta: { changes: 1 } };
  if (sql.startsWith("pragma table_info(quote_acquisition_attribution)")) {
    return {
      results: [
        { name: "quote_id" },
        { name: "email" },
        { name: "schema_version" },
        { name: "first_touch_json" },
        { name: "quote_session_json" },
        { name: "checkout_session_json" },
        { name: "consent_state_json" },
        { name: "quote_session_captured_at" },
        { name: "checkout_session_captured_at" },
        { name: "checkout_stripe_session_id" },
        { name: "created_at" },
        { name: "updated_at" },
      ],
    };
  }
  if (sql.startsWith("insert into quote_acquisition_attribution")) {
    const quoteId = String(args[0] || "");
    const existing = db.rows.get(quoteId) || {};
    const isCheckoutUpsert = args.length === 8;
    const next: any = { ...existing, quote_id: quoteId };

    next.email = args[1] || next.email || null;
    next.schema_version = Number(args[2] || 1);

    if (!existing.first_touch_json && args[3]) next.first_touch_json = args[3];
    if (existing.first_touch_json) next.first_touch_json = existing.first_touch_json;
    if (!next.first_touch_json && args[3]) next.first_touch_json = args[3];

    if (isCheckoutUpsert) {
      if (args[4]) next.checkout_session_json = args[4];
      if (args[5]) next.consent_state_json = args[5];
      if (args[6]) next.checkout_session_captured_at = args[6];
      if (args[7]) next.checkout_stripe_session_id = args[7];
    } else {
      if (args[4]) next.quote_session_json = args[4];
      if (args[5]) next.consent_state_json = args[5];
      if (args[6]) next.quote_session_captured_at = args[6];
    }

    db.rows.set(quoteId, next);
    return { success: true, meta: { changes: 1 } };
  }
  if (mode === "all") return { results: [] };
  return null;
}

describe("Phase 3 attribution sanitization", () => {
  it("strips ad and analytics IDs when consent is denied", () => {
    const payload = sanitizeAttributionPayload({
      consent_state: { analytics: false, marketing: false },
      first_touch: {
        source: "google",
        medium: "cpc",
        gclid: "AAA",
        gbraid: "BBB",
        wbraid: "CCC",
        ga_client_id: "123.456",
        ga_session_id: "777",
      },
    }, "quote");
    expect(payload.first_touch?.gclid).toBeNull();
    expect(payload.first_touch?.gbraid).toBeNull();
    expect(payload.first_touch?.wbraid).toBeNull();
    expect(payload.first_touch?.ga_client_id).toBeNull();
    expect(payload.first_touch?.ga_session_id).toBeNull();
  });

  it("keeps IDs when consent is granted", () => {
    const payload = sanitizeAttributionPayload({
      consent_state: { analytics: true, marketing: true },
      first_touch: {
        source: "google",
        medium: "cpc",
        gclid: "AAA",
        ga_client_id: "123.456",
      },
    }, "quote");
    expect(payload.first_touch?.gclid).toBe("AAA");
    expect(payload.first_touch?.ga_client_id).toBe("123.456");
  });

  it("sanitizes magic-link landing paths to /quote/", () => {
    const payload = sanitizeAttributionPayload({
      consent_state: { analytics: true, marketing: true },
      quote_session: { landing_path: "/quote/QT-261030-001/" },
    }, "quote");
    expect(payload.quote_session?.landing_path).toBe("/quote/");
  });

  it("returns null touches for empty payloads", () => {
    const payload = sanitizeAttributionPayload({}, "checkout");
    expect(payload.first_touch).toBeNull();
    expect(payload.checkout_session).toBeNull();
  });

  it("normalizes source and medium casing", () => {
    const payload = sanitizeAttributionPayload({
      consent_state: { analytics: false, marketing: false },
      first_touch: { source: "GoOgLe", medium: "CpC" },
    }, "quote");
    expect(payload.first_touch?.source).toBe("google");
    expect(payload.first_touch?.medium).toBe("cpc");
  });

  it("extracts unique quote IDs from quote_id and qi fields", () => {
    const ids = extractUniqueQuoteIdsFromItems([
      { quote_id: "QT-1" },
      { qi: "QT-2" },
      { quote_id: "QT-1" },
      { quote_id: "" },
    ]);
    expect(ids.sort()).toEqual(["QT-1", "QT-2"]);
  });
});

describe("Phase 3 attribution upsert persistence", () => {
  let env: any;
  let db: AttrDb;

  beforeEach(() => {
    db = new AttrDb();
    env = { DB: db };
  });

  it("stores first-touch and quote-session on quote creation", async () => {
    const payload = sanitizeAttributionPayload({
      consent_state: { analytics: false, marketing: false },
      first_touch: { source: "google", medium: "cpc", landing_path: "/" },
      quote_session: { source: "google", medium: "cpc", landing_path: "/product/standard-fitted-sheet/" },
    }, "quote");
    await upsertQuoteAttributionFromQuote(env, "QT-100", "buyer@example.com", payload);
    const row = db.rows.get("QT-100");
    expect(row).toBeTruthy();
    expect(JSON.parse(row.first_touch_json).landing_path).toBe("/");
    expect(JSON.parse(row.quote_session_json).landing_path).toBe("/product/standard-fitted-sheet/");
  });

  it("writes checkout-session attribution for multiple quote IDs", async () => {
    const payload = sanitizeAttributionPayload({
      consent_state: { analytics: true, marketing: true },
      checkout_session: { source: "newsletter", medium: "email", landing_path: "/checkout/" },
    }, "checkout");
    await upsertQuoteAttributionFromCheckout(env, ["QT-200", "QT-201"], "buyer@example.com", payload, "cs_live_1");
    expect(JSON.parse(db.rows.get("QT-200").checkout_session_json).source).toBe("newsletter");
    expect(JSON.parse(db.rows.get("QT-201").checkout_session_json).medium).toBe("email");
    expect(db.rows.get("QT-200").checkout_stripe_session_id).toBe("cs_live_1");
  });

  it("does not overwrite existing first-touch when checkout data differs", async () => {
    await upsertQuoteAttributionFromQuote(env, "QT-300", "buyer@example.com", sanitizeAttributionPayload({
      consent_state: { analytics: false, marketing: false },
      first_touch: { source: "google", medium: "cpc", landing_path: "/" },
    }, "quote"));
    await upsertQuoteAttributionFromCheckout(env, ["QT-300"], "buyer@example.com", sanitizeAttributionPayload({
      consent_state: { analytics: true, marketing: true },
      first_touch: { source: "bing", medium: "cpc", landing_path: "/other/" },
      checkout_session: { source: "email", medium: "newsletter", landing_path: "/checkout/" },
    }, "checkout"), "cs_live_2");
    const firstTouch = JSON.parse(db.rows.get("QT-300").first_touch_json);
    expect(firstTouch.source).toBe("google");
    expect(firstTouch.landing_path).toBe("/");
  });

  it("creates a row from checkout-only payload when quote row is missing", async () => {
    await upsertQuoteAttributionFromCheckout(env, ["QT-400"], "buyer@example.com", sanitizeAttributionPayload({
      consent_state: { analytics: false, marketing: false },
      first_touch: { source: "(direct)", medium: "(none)", landing_path: "/" },
      checkout_session: { source: "(direct)", medium: "(none)", landing_path: "/checkout/" },
    }, "checkout"), "cs_live_3");
    const row = db.rows.get("QT-400");
    expect(row).toBeTruthy();
    expect(JSON.parse(row.first_touch_json).source).toBe("(direct)");
    expect(JSON.parse(row.checkout_session_json).landing_path).toBe("/checkout/");
  });
});

describe("Phase 3 browser-side attribution capture (cookie-consent.js)", () => {
  function makeStorage(seed: Record<string, string> = {}) {
    const m = new Map<string, string>(Object.entries(seed));
    return {
      getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
      setItem: (k: string, v: string) => { m.set(k, String(v)); },
      removeItem: (k: string) => { m.delete(k); },
      _map: m,
    };
  }

  function bootCookieConsent(overrides: any = {}) {
    const src = readFileSync(`${ROOT}/public/js/cookie-consent.js`, "utf8");
    const localStorage = makeStorage(overrides.localStorageSeed || {});
    const sessionStorage = makeStorage();
    const cookies: string[] = (overrides.cookies || []).slice();
    const documentObj: any = {
      readyState: "loading",
      referrer: overrides.referrer || "",
      body: { appendChild: () => {}, style: {} },
      querySelector: () => null,
      getElementById: () => null,
      addEventListener: () => {},
      createElement: () => ({ innerHTML: "", appendChild: () => {}, style: {} }),
    };
    Object.defineProperty(documentObj, "cookie", {
      get: () => cookies.join("; "),
      set: (v: string) => { cookies.push(String(v)); },
      configurable: true,
    });
    const sandbox: any = {
      console,
      localStorage,
      sessionStorage,
      document: documentObj,
      setTimeout: () => 0,
      clearTimeout: () => {},
      URL,
      URLSearchParams,
      window: {
        location: {
          search: overrides.search || "",
          pathname: overrides.pathname || "/",
          hostname: overrides.hostname || "www.mildmate.com",
        },
        dataLayer: [],
      },
    };
    sandbox.window.localStorage = localStorage;
    sandbox.window.sessionStorage = sessionStorage;
    sandbox.globalThis = sandbox.window;
    Object.assign(sandbox.window, sandbox);
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return sandbox;
  }

  it("provides quote-session snapshots via __mildmateGetAttributionSnapshot", () => {
    const sb = bootCookieConsent({
      search: "?utm_source=google&utm_medium=cpc&utm_campaign=phase3",
      pathname: "/product/standard-fitted-sheet/",
    });
    const snap = sb.window.__mildmateGetAttributionSnapshot("quote");
    expect(snap.quote_session.source).toBe("google");
    expect(snap.quote_session.medium).toBe("cpc");
    expect(snap.quote_session.utm_campaign).toBe("phase3");
  });

  it("keeps ad IDs null by default because marketing consent is denied", () => {
    const sb = bootCookieConsent({
      search: "?utm_source=google&utm_medium=cpc&gclid=AAA",
      pathname: "/",
    });
    const snap = sb.window.__mildmateGetAttributionSnapshot("quote");
    expect(snap.consent_state.marketing).toBe(false);
    expect(snap.quote_session.gclid).toBeNull();
  });

  it("includes ad and analytics IDs after explicit consent grant", () => {
    const sb = bootCookieConsent({
      search: "?utm_source=google&utm_medium=cpc&gclid=AAA",
      pathname: "/",
      cookies: ["_ga=GA1.1.123456789.1700000000", "_ga_ABC=GS1.1.1700000000.1.0.1700000000.0.0.0"],
      localStorageSeed: {
        "mildmate-cookie-consent": JSON.stringify({ essential: true, analytics: true, marketing: true, timestamp: Date.now() }),
      },
    });
    const snap = sb.window.__mildmateGetAttributionSnapshot("checkout");
    expect(snap.consent_state.marketing).toBe(true);
    expect(snap.checkout_session.gclid).toBe("AAA");
    expect(snap.checkout_session.ga_client_id).toBeTruthy();
  });

  it("preserves first-touch and redacts magic-link landing paths", () => {
    const sb = bootCookieConsent({
      search: "?utm_source=google&utm_medium=cpc",
      pathname: "/product/custom-waterproof-cushion-protector/",
    });
    const first = sb.window.__mildmateGetAttributionSnapshot("quote");
    sb.window.location.search = "";
    sb.window.location.pathname = "/quote/QT-261030-001/";
    const second = sb.window.__mildmateGetAttributionSnapshot("checkout");
    expect(first.first_touch.source).toBe("google");
    expect(second.first_touch.source).toBe("google");
    expect(second.checkout_session.landing_path).toBe("/quote/");
  });
});
