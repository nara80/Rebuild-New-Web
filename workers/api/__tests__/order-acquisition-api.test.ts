// Order Acquisition (First-Touch) dashboard extension — GET /api/admin/analysis/order-acquisition
//
// Covers: paid-order channel aggregation over checkout_session_snapshots
// attribution (first-touch vs checkout-session kept separate), Unavailable ≠
// Direct, test-session exclusion (TEST- prefix), per-currency revenue
// isolation, paid-click evidence (gclid only), PII-free responses, no DB
// mutation (read-only), and central auth denial on production host.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { verifyClerkJwt } from "../clerk-verify";
import { handleAdminAnalysis } from "../admin-analysis";

const verifyMock = vi.mocked(verifyClerkJwt);

// ── Fake D1 ────────────────────────────────────────────────────────────────

type Row = Record<string, any>;

interface FakeTables {
  orders: Row[]; // rows already joined to snapshot attribution (attribution_json)
  fail_on?: string[];
}

function makeFakeDb(tables: FakeTables) {
  return {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, " ");
      const thrower = () => {
        if (tables.fail_on && tables.fail_on.some((f) => s.includes(f))) {
          throw new Error("no such table: simulated");
        }
      };
      return {
        bind(..._args: any[]) {
          return this;
        },
        async first(): Promise<Row | null> {
          thrower();
          return null;
        },
        async all(): Promise<{ results: Row[] }> {
          thrower();
          if (s.includes("FROM orders o") && s.includes("LEFT JOIN checkout_session_snapshots s")) {
            return { results: tables.orders.map((r) => ({ ...r })) };
          }
          return { results: [] };
        },
      };
    },
  };
}

function makeEnv(tables: FakeTables) {
  return { DB: makeFakeDb(tables), ADMIN_EMAILS: "admin@example.com" };
}

async function getOrderAcquisition(env: any, url: string, headers?: Record<string, string>): Promise<{ status: number; body: any }> {
  const res = await handleAdminAnalysis(new Request(url, { headers: headers || {} }), env);
  const body = await res.json();
  return { status: res.status, body };
}

// Non-production host + X-Admin-Secret with no configured secret → local-dev
// auth passes (same convention as phase5-quote-funnel.test.ts).
const DEV_AUTH = { "X-Admin-Secret": "test" };

// ── Fixtures ───────────────────────────────────────────────────────────────

const CHATGPT_FT = {
  source: "chatgpt.com", medium: "unknown", utm_source: "chatgpt.com", utm_medium: "unknown",
  gclid: null, gbraid: null, wbraid: null,
  landing_path: "/product/family-fitted-sheet/",
};
const CHATGPT_ATTR = {
  first_touch: CHATGPT_FT,
  checkout_session: { source: "(direct)", medium: "(none)", utm_source: "(direct)", utm_medium: "(none)", landing_path: "/checkout/", gclid: null, gbraid: null, wbraid: null },
};
const ADS_ATTR = {
  first_touch: { source: "google", medium: "cpc", utm_source: "google", utm_medium: "cpc", gclid: "GCLSID-XYZ", landing_path: "/product/duvet-insert/" },
  checkout_session: { source: "google", medium: "cpc", gclid: "GCLSID-XYZ", landing_path: "/checkout/" },
};

function baseTables(): FakeTables {
  return {
    orders: [
      // S1: paid, 2 USD lines, chatgpt.com first touch
      { stripe_session_id: "cs_a", email: "buyer1@example.com", product_slug: "family-fitted-sheet", product_title_en: "Family Fitted Sheet", quantity: 1, price_usd: 99, price_thb: null, currency: "usd", status: "confirmed", created_at: "2026-11-02 06:36:26", attribution_json: JSON.stringify(CHATGPT_ATTR) },
      { stripe_session_id: "cs_a", email: "buyer1@example.com", product_slug: "pillowcase-envelope", product_title_en: "Envelope Pillowcase", quantity: 1, price_usd: 15, price_thb: null, currency: "usd", status: "confirmed", created_at: "2026-11-02 06:36:26", attribution_json: JSON.stringify(CHATGPT_ATTR) },
      // S2: paid THB order, paid click evidence
      { stripe_session_id: "cs_b", email: "buyer2@example.com", product_slug: "duvet-insert", product_title_en: "Duvet Insert", quantity: 1, price_usd: null, price_thb: 1800, currency: "thb", status: "confirmed", created_at: "2026-11-02 05:00:00", attribution_json: JSON.stringify(ADS_ATTR) },
      // S3: unpaid (pending) — counts as session, never paid
      { stripe_session_id: "cs_c", email: "buyer1@example.com", product_slug: "family-fitted-sheet", product_title_en: "Family Fitted Sheet", quantity: 1, price_usd: 99, price_thb: null, currency: "usd", status: "pending", created_at: "2026-11-01 10:00:00", attribution_json: JSON.stringify(CHATGPT_ATTR) },
      // S4: paid, no snapshot attribution → first-touch Unavailable
      { stripe_session_id: "cs_d", email: "buyer3@example.com", product_slug: "pet-owner-duvet-cover", product_title_en: "Pet Owner Duvet Cover", quantity: 1, price_usd: null, price_thb: 3700, currency: "thb", status: "shipped", created_at: "2026-10-31 09:00:00", attribution_json: null },
      // S5: test session → excluded entirely
      { stripe_session_id: "TEST-MAKE-001", email: "test@example.com", product_slug: "x", product_title_en: "Test", quantity: 1, price_usd: 999, price_thb: null, currency: "usd", status: "confirmed", created_at: "2026-11-02 00:00:00", attribution_json: null },
    ],
  };
}

describe("order acquisition endpoint (first-touch, PII-free)", () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  it("aggregates paid-order channels with currency isolation and paid-click evidence", async () => {
    const env = makeEnv(baseTables());
    const { status, body } = await getOrderAcquisition(env, "https://localhost/api/admin/analysis/order-acquisition", DEV_AUTH);
    expect(status).toBe(200);
    expect(body.available).toBe(true);

    const s = body.summary;
    expect(s.order_rows).toBe(5); // 6 rows − 1 test row (excluded from all counters)
    expect(s.sessions).toBe(4); // TEST- session excluded
    expect(s.paid_sessions).toBe(3); // cs_a, cs_b, cs_d
    expect(s.paid_order_rows).toBe(4);
    expect(s.unique_customers).toBe(3);
    expect(s.first_touch_unavailable).toBe(1); // cs_d

    const ft = body.first_touch_channels as any[];
    const chat = ft.find((r) => r.channel === "chatgpt.com/unknown");
    expect(chat).toBeDefined();
    expect(chat.orders).toBe(2);
    expect(chat.paid_orders).toBe(1);
    expect(chat.unique_customers).toBe(1);
    expect(chat.revenue_usd).toBe(114); // 99 + 15, unit × qty
    expect(chat.revenue_thb).toBe(0);
    expect(chat.paid_click_orders).toBe(0);

    const ads = ft.find((r) => r.channel === "google/cpc");
    expect(ads).toBeDefined();
    expect(ads.paid_orders).toBe(1);
    expect(ads.revenue_usd).toBe(0); // never blended
    expect(ads.revenue_thb).toBe(1800);
    expect(ads.paid_click_orders).toBe(1); // recorded gclid

    const cs = body.checkout_channels as any[];
    const direct = cs.find((r) => r.channel === "(direct)/(none)");
    expect(direct).toBeDefined();
    expect(direct.paid_orders).toBe(1);

    expect(body.landing_paths.some((l: any) => l.landing_path === "/product/family-fitted-sheet/")).toBe(true);
  });

  it("returns PII-free recent paid orders", async () => {
    const env = makeEnv(baseTables());
    const { body } = await getOrderAcquisition(env, "https://localhost/api/admin/analysis/order-acquisition", DEV_AUTH);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("buyer1@example.com");
    expect(raw).not.toContain("buyer2@example.com");
    expect(raw).not.toContain("buyer3@example.com");
    expect(raw.toLowerCase()).not.toContain("@example.com");

    const recent = body.recent_paid_orders as any[];
    expect(recent.length).toBe(3); // cs_a, cs_b, cs_d (cs_c unpaid, TEST- excluded)
    expect(recent[0].order_session.startsWith("cs_")).toBe(true);
    expect(recent[0].order_session.length).toBeLessThanOrEqual(15); // truncated
    for (const r of recent) {
      expect(r).not.toHaveProperty("email");
      expect(Array.isArray(r.currency_amounts)).toBe(true);
    }
    // cs_a shows the multi-line session total
    const a = recent.find((r) => r.order_session.startsWith("cs_a"));
    expect(a.currency_amounts).toContainEqual({ currency: "USD", amount: 114 });
  });

  it("is read-only: no DB mutation possible", async () => {
    const tables = baseTables();
    const env = makeEnv(tables);
    await getOrderAcquisition(env, "https://localhost/api/admin/analysis/order-acquisition", DEV_AUTH);
    expect(tables.orders.length).toBe(6);
    // fake DB exposes no run()/write path; rows unchanged above
  });

  it("denies anonymous and secret-only requests on the production host", async () => {
    const env = makeEnv(baseTables());

    const anon = await getOrderAcquisition(env, "https://www.mildmate.com/api/admin/analysis/order-acquisition");
    expect(anon.status).toBe(401);

    const secretOnly = await getOrderAcquisition(
      { ...env, ADMIN_SECRET: "expected" },
      "https://www.mildmate.com/api/admin/analysis/order-acquisition",
      { "X-Admin-Secret": "expected" }
    );
    expect(secretOnly.status).toBe(401);
  });

  it("denies invalid JWTs and non-admin Clerk users", async () => {
    const env = makeEnv(baseTables());

    // Invalid JWT on the production host: bearer present but verification
    // fails → secret fallback is blocked in prod → 401.
    verifyMock.mockResolvedValue({ valid: false, status: 401, error: "Token expired" } as any);
    const prodBad = await getOrderAcquisition(
      env,
      "https://www.mildmate.com/api/admin/analysis/order-acquisition",
      { Authorization: "Bearer invalid.jwt" }
    );
    expect(prodBad.status).toBe(401);

    // Valid JWT but no admin role and non-allowlisted email → 403.
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "user" }, email: "customer@example.com", sub: "user_2" },
    } as any);
    const nonAdmin = await getOrderAcquisition(
      env,
      "https://www.mildmate.com/api/admin/analysis/order-acquisition",
      { Authorization: "Bearer valid.jwt" }
    );
    expect(nonAdmin.status).toBe(403);
  });

  it("degrades to available:false when snapshot/orders tables are missing", async () => {
    const env = makeEnv({ orders: [], fail_on: ["checkout_session_snapshots"] });
    const { status, body } = await getOrderAcquisition(env, "https://localhost/api/admin/analysis/order-acquisition", DEV_AUTH);
    expect(status).toBe(200);
    expect(body.available).toBe(false);
  });
});
