// Phase 16 — AI Analyst & Marketing Action Feedback Loop regression suite.
// Covers: provider-neutral availability, recommendation grounding (no invented
// product IDs / metrics), low-confidence caution flags, human approve/reject/
// review workflow, audit attribution, baseline snapshots, feedback loop, and
// admin authentication.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { verifyClerkJwt } from "../clerk-verify";
import { handleAdminAiAnalyst, buildAiInputContract, validateRecommendations } from "../admin-ai-analyst";

const verifyMock = vi.mocked(verifyClerkJwt);

const ADMIN_JWT =
  "x." + Buffer.from(JSON.stringify({ email: "admin@example.com" })).toString("base64url") + ".sig";

function req(path: string, init?: RequestInit): Request {
  return new Request("https://preview.mildmate-new.pages.dev" + path, {
    ...init,
    headers: { Authorization: "Bearer " + ADMIN_JWT, ...(init?.headers || {}) },
  });
}

function makeDb(options: any = {}) {
  const state: any = {
    inserts: [],
    updates: [],
    actions: options.actions || [],
  };
  const products = options.products ?? [
    { id: 1, slug: "standard-fitted-sheet", title_en: "Standard Fitted Sheet" },
    { id: 2, slug: "marine-fitted-sheet", title_en: "Marine Fitted Sheet" },
  ];
  const db = {
    prepare(sql: string) {
      const make = (args: any[]) => ({
        async first() {
          if (sql.includes("FROM opportunity_scores ORDER BY score_date DESC")) {
            return options.oppLatest ?? null;
          }
          if (sql.includes("FROM opportunity_scores WHERE product_id")) {
            return options.baselineOpp ?? null;
          }
          if (sql.includes("FROM sync_runs")) {
            const prefix = String(args[0] || "").replace("%", "");
            return options.syncBySource ? options.syncBySource[prefix] ?? null : null;
          }
          if (sql.includes("SELECT * FROM marketing_actions WHERE id = ?1")) {
            return state.actions.find((a: any) => a.id === Number(args[0])) ?? null;
          }
          return null;
        },
        async all() {
          if (sql.includes("FROM products WHERE is_active")) return { results: products };
          if (sql.includes("JOIN products p ON p.id = o.product_id")) {
            return { results: options.oppRows ?? [] };
          }
          if (sql.includes("status = 'reviewed'")) return { results: options.reviewed ?? [] };
          if (sql.includes("FROM marketing_actions")) {
            const status = sql.includes("WHERE status = ?1") ? args[0] : null;
            const rows = status ? state.actions.filter((a: any) => a.status === status) : state.actions;
            return { results: rows };
          }
          return { results: [] };
        },
        async run() {
          if (sql.includes("INSERT INTO marketing_actions")) state.inserts.push(args);
          if (sql.includes("UPDATE marketing_actions")) {
            state.updates.push({ id: Number(args[0]), sql, args });
            const row = state.actions.find((a: any) => a.id === Number(args[0]));
            if (row) {
              if (sql.includes("status='approved'")) {
                row.status = "approved";
                row.baseline_metrics_json = args[1];
                if (args[2] !== null && args[2] !== undefined) row.approved_budget = args[2];
                row.approved_by = args[3];
                row.approved_at = args[4];
              } else if (sql.includes("status='rejected'")) {
                row.status = "rejected";
                row.rejected_by = args[1];
                row.rejected_at = args[2];
              } else if (sql.includes("status='reviewed'")) {
                row.status = "reviewed";
                row.result_class = args[1];
                row.post_metrics_json = args[2];
                row.lessons = args[3];
                row.reviewed_by = args[4];
                row.reviewed_at = args[5];
              }
            }
          }
          return { success: true };
        },
      });
      // Support both .prepare(sql).all() and .prepare(sql).bind(...).all()
      const direct = make([]);
      return Object.assign({ bind: (...args: any[]) => make(args) }, direct);
    },
  };
  return { db, state };
}

function envWith(db: any, extra: any = {}) {
  return { ADMIN_EMAILS: "admin@example.com", DB: db, ...extra } as any;
}

const validRec = {
  product_id: 1,
  channel: "",
  action: "Push Standard Fitted Sheet in GSC content",
  action_type: "content",
  why: "Top opportunity score 82 with confidence 70 in the latest snapshot.",
  budget_test: null,
  budget: null,
  budget_currency: "THB",
  success_target: "+10 organic sessions /wk in 28 days",
  confidence: 70,
  review_date: "2026-12-06",
};

function providerResponse(list: any[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ recommendations: list }) } }],
    }),
  } as any;
}

beforeEach(() => {
  verifyMock.mockReset();
  verifyMock.mockResolvedValue({
    valid: true,
    payload: { raw: { role: "admin" }, email: "admin@example.com", sub: "user_1" },
  } as any);
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fetch not expected in this test"); }));
});

describe("Phase 16 — authentication", () => {
  it("rejects unauthenticated requests with 401", async () => {
    verifyMock.mockResolvedValue({ valid: false, status: 401, error: "bad token" } as any);
    const res = await handleAdminAiAnalyst(
      new Request("https://preview.mildmate-new.pages.dev/api/admin/ai-analyst/actions", {
        headers: { Authorization: "Bearer bogus" },
      }),
      envWith(makeDb().db)
    );
    expect(res.status).toBe(401);
  });

  it("rejects non-admin role with 403", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "customer" }, email: "admin@example.com", sub: "user_1" },
    } as any);
    const res = await handleAdminAiAnalyst(req("/api/admin/ai-analyst/actions"), envWith(makeDb().db));
    expect(res.status).toBe(403);
  });
});

describe("Phase 16 — provider-neutral availability", () => {
  it("returns ai_available:false and stores nothing when AI_API_KEY is missing", async () => {
    const { db, state } = makeDb();
    const res = await handleAdminAiAnalyst(req("/api/admin/ai-analyst/recommend", { method: "POST", body: JSON.stringify({}) }), envWith(db));
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.ai_available).toBe(false);
    expect(body.message).toMatch(/not configured/i);
    expect(state.inserts).toHaveLength(0);
  });
});

describe("Phase 16 — recommendation grounding", () => {
  it("stores only grounded recommendations and reports rejected invented ones", async () => {
    const { db, state } = makeDb();
    const invented = { ...validRec, product_id: 999, action: "Push invented product" };
    vi.stubGlobal("fetch", vi.fn(async () => providerResponse([validRec, invented])));

    const res = await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/recommend", { method: "POST", body: JSON.stringify({}) }),
      envWith(db, { AI_API_KEY: "test-key", AI_MODEL: "test-model" })
    );
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.stored).toBe(1);
    expect(body.rejected).toHaveLength(1);
    expect(body.rejected[0].reasons.join(" ")).toMatch(/invented or unknown product_id/);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0][2]).toBe(1); // product_id
    expect(state.inserts[0][1]).toBe("test-model"); // ai_model audit
  });

  it("flags caution on every recommendation when data confidence is not high", async () => {
    const { db, state } = makeDb({ syncBySource: { ga4: { source: "ga4", status: "success", ran_at: new Date(Date.now() - 20 * 86400000).toISOString().replace("T", " ").slice(0, 19) } } });
    vi.stubGlobal("fetch", vi.fn(async () => providerResponse([validRec])));
    const res = await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/recommend", { method: "POST", body: JSON.stringify({}) }),
      envWith(db, { AI_API_KEY: "test-key" })
    );
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.stored).toBe(1);
    // caution flag is persisted on the stored row (INSERT bind arg 12 = caution)
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0][12]).toBe(1);
    expect(String(state.inserts[0][13])).toMatch(/cautious|confidence/i);
  });

  it("validateRecommendations marks ads-channel recommendations with the unverified-attribution caveat", () => {
    const contract: any = {
      canonical_products: [{ id: 1 }],
      data_confidence: { status: "high" },
      unverified_signals: { google_ads_purchase_attribution: "UNVERIFIED" },
    };
    const { valid } = validateRecommendations(contract, [
      { product_id: 1, channel: "google-ads", action: "Test", why: "Because", confidence: 50 },
    ]);
    expect(valid).toHaveLength(1);
    expect(valid[0].caution).toBe(1);
    expect(valid[0].caution_note).toMatch(/UNVERIFIED/);
  });

  it("validateRecommendations rejects missing why/action/confidence", () => {
    const contract: any = {
      canonical_products: [{ id: 1 }],
      data_confidence: { status: "high" },
      unverified_signals: {},
    };
    const { valid, rejected } = validateRecommendations(contract, [
      { product_id: 1, action: "", why: "", confidence: 700 },
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reasons.join(" ")).toMatch(/missing action/);
    expect(rejected[0].reasons.join(" ")).toMatch(/confidence/);
  });
});

describe("Phase 16 — human approval / rejection / review workflow", () => {
  async function seedApprovedRow() {
    const proposedRow = {
      id: 5,
      action_date: "2026-11-06",
      source: "ai",
      ai_model: "test-model",
      status: "proposed",
      product_id: 1,
      channel: "",
      action_type: "content",
      title: "Test action",
      detail: "Because",
      recommendation_json: JSON.stringify(validRec),
      approved_budget: null,
      caution: 0,
    };
    const { db, state } = makeDb({ actions: [proposedRow], baselineOpp: { score_date: "2026-11-02", score: 82, confidence: 70, tier: "HIGH" } });
    return { db, state };
  }

  it("approve captures baseline snapshot and human attribution", async () => {
    const { db, state } = await seedApprovedRow();
    const res = await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/actions/5", { method: "PUT", body: JSON.stringify({ op: "approve", budget: 5000 }) }),
      envWith(db)
    );
    const body: any = await res.json();
    expect(body.status).toBe("approved");
    expect(body.approved_by).toBe("admin@example.com");
    expect(state.updates).toHaveLength(1);
    const baseline = JSON.parse(state.updates[0].args[1]);
    expect(baseline.opportunity_at_approval.score).toBe(82);
    expect(state.updates[0].args[2]).toBe(5000); // approved budget
    expect(state.actions[0].approved_by).toBe("admin@example.com");
  });

  it("rejects invalid transition (approve an already-approved action) with 409", async () => {
    const { db } = await seedApprovedRow();
    // first approve
    await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/actions/5", { method: "PUT", body: JSON.stringify({ op: "approve" }) }),
      envWith(db)
    );
    // approve again
    const res = await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/actions/5", { method: "PUT", body: JSON.stringify({ op: "approve" }) }),
      envWith(db)
    );
    expect(res.status).toBe(409);
  });

  it("review requires a valid result class and stores post metrics + lessons", async () => {
    const { db, state } = await seedApprovedRow();
    await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/actions/5", { method: "PUT", body: JSON.stringify({ op: "approve" }) }),
      envWith(db)
    );
    const bad = await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/actions/5", { method: "PUT", body: JSON.stringify({ op: "review", result_class: "amazing" }) }),
      envWith(db)
    );
    expect(bad.status).toBe(400);

    const good = await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/actions/5", {
        method: "PUT",
        body: JSON.stringify({ op: "review", result_class: "positive", post_metrics: { sessions: 120 }, lessons: "Content worked" }),
      }),
      envWith(db)
    );
    const body: any = await good.json();
    expect(body.status).toBe("reviewed");
    expect(body.result_class).toBe("positive");
    expect(body.reviewed_by).toBe("admin@example.com");
    expect(state.actions[0].result_class).toBe("positive");
    expect(JSON.parse(state.actions[0].post_metrics_json)).toEqual({ sessions: 120 });
    expect(state.actions[0].lessons).toBe("Content worked");
  });

  it("review is blocked until the action is approved", async () => {
    const { db } = await seedApprovedRow();
    const res = await handleAdminAiAnalyst(
      req("/api/admin/ai-analyst/actions/5", { method: "PUT", body: JSON.stringify({ op: "review", result_class: "neutral" }) }),
      envWith(db)
    );
    expect(res.status).toBe(409);
  });
});

describe("Phase 16 — feedback loop and contract", () => {
  it("input contract includes reviewed past outcomes and unverified Ads signal", async () => {
    const { db } = makeDb({
      reviewed: [{ id: 2, action_date: "2026-10-20", product_id: 2, channel: "etsy", action_type: "campaign", title: "Etsy push", result_class: "neutral", lessons: "weak lift", reviewed_at: "2026-11-01T00:00:00" }],
    });
    const contract = await buildAiInputContract(envWith(db));
    expect(contract.past_outcomes).toHaveLength(1);
    expect(contract.past_outcomes[0].result_class).toBe("neutral");
    expect(contract.unverified_signals.google_ads_purchase_attribution).toMatch(/UNVERIFIED/);
    expect(contract.canonical_products.length).toBe(2);
  });

  it("lists actions with status filter", async () => {
    const { db } = makeDb({
      actions: [
        { id: 1, status: "proposed" },
        { id: 2, status: "reviewed" },
      ],
    });
    const res = await handleAdminAiAnalyst(req("/api/admin/ai-analyst/actions?status=reviewed"), envWith(db));
    const body: any = await res.json();
    expect(body.available).toBe(true);
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].id).toBe(2);
  });

  it("reports schema-unavailable explicitly when marketing_actions table is missing", async () => {
    const failing = {
      prepare: () => {
        throw new Error("no such table: marketing_actions");
      },
    };
    const res = await handleAdminAiAnalyst(req("/api/admin/ai-analyst/actions"), envWith(failing));
    const body: any = await res.json();
    expect(body.available).toBe(false);
    expect(body.error_code).toBe("MARKETING_ACTIONS_SCHEMA_UNAVAILABLE");
  });
});
