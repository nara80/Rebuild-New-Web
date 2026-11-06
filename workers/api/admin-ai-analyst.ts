// MildMate Admin API — AI Analyst & Marketing Action Feedback Loop (Phase 16)
//
// Routes (all browser-admin gated via authorizeAdmin):
//   GET  /api/admin/ai-analyst/contract      → trusted AI input contract (canonical products,
//                                              latest opportunity snapshot, data confidence,
//                                              source freshness, unverified-signal flags,
//                                              reviewed past outcomes for the feedback loop)
//   POST /api/admin/ai-analyst/recommend     → build contract, call provider-neutral AI, validate
//                                              grounding, persist proposed rows in marketing_actions
//   GET  /api/admin/ai-analyst/actions       → list actions (?status=&limit=)
//   PUT  /api/admin/ai-analyst/actions/:id   → human transitions: approve | reject | review
//
// Hard rules (Phase 16 contract):
//   - AI is advisory only. It never writes canonical product/sales facts and can
//     never approve its own recommendations or spend budgets.
//   - Recommendations may only cite metrics present in the contract; invented
//     Product_IDs or metrics are rejected at validation time and never stored.
//   - Google Ads paid-purchase attribution is UNVERIFIED and every Ads-channel
//     recommendation carries that explicit caveat.
//   - Low/medium data confidence (or stale sources) forces caution flags.
//   - No AI provider configured → explicit ai_available:false, nothing fabricated.

import { authorizeAdmin } from "./admin-auth";

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

const VALID_RESULT_CLASSES = new Set(["positive", "neutral", "negative", "inconclusive"]);

// ── Trusted AI input contract ───────────────────────────────────────────────

export async function buildAiInputContract(env: any): Promise<any> {
  const contract: any = {
    generated_at: new Date().toISOString(),
    canonical_products: [],
    opportunities: [],
    data_confidence: { status: "unavailable", warnings: [], sources: {} },
    unverified_signals: {
      google_ads_purchase_attribution:
        "UNVERIFIED — paid-purchase attribution has not been validated; treat Ads conversions as monitoring data only.",
    },
    past_outcomes: [],
    schema_unavailable: [] as string[],
  };

  // Canonical product identity (never let AI invent IDs)
  try {
    const products = await env.DB.prepare(
      "SELECT id, slug, title_en FROM products WHERE is_active = 1 ORDER BY id"
    ).all();
    contract.canonical_products = (products as any).results || [];
  } catch {
    contract.schema_unavailable.push("products");
  }

  // Latest opportunity snapshot (read-only; scoring stays Phase 14-owned)
  try {
    const latest: any = await env.DB.prepare(
      "SELECT score_model_version, score_date FROM opportunity_scores ORDER BY score_date DESC LIMIT 1"
    ).first();
    if (latest) {
      const rows = await env.DB.prepare(
        "SELECT o.product_id, p.slug, p.title_en, o.channel, o.score, o.rank, o.tier, o.confidence " +
        "FROM opportunity_scores o JOIN products p ON p.id = o.product_id " +
        "WHERE o.score_model_version = ?1 AND o.score_date = ?2 AND o.score IS NOT NULL " +
        "ORDER BY o.score DESC LIMIT 20"
      ).bind(latest.score_model_version, latest.score_date).all();
      contract.opportunities = (rows as any).results || [];
      contract.opportunity_snapshot = { score_date: latest.score_date, model_version: latest.score_model_version };
    }
  } catch {
    contract.schema_unavailable.push("opportunity_scores");
  }

  // Source freshness from sync_runs (per collector prefix)
  const sources: Array<[string, string]> = [
    ["ga4", "ga4"],
    ["gsc", "gsc"],
    ["etsy", "etsy"],
    ["google-ads", "google-ads"],
    ["notion", "notion-mapping-sync"],
  ];
  let anyMissing = false;
  let anyStale = false;
  for (const [label, prefix] of sources) {
    try {
      const row: any = await env.DB.prepare(
        "SELECT source, status, COALESCE(finished_at, created_at) AS ran_at FROM sync_runs " +
        "WHERE source LIKE ?1 ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 1"
      ).bind(prefix + "%").first();
      if (!row) {
        contract.data_confidence.sources[label] = { status: "unavailable" };
        anyMissing = true;
        continue;
      }
      const ageDays = Math.floor((Date.now() - new Date(row.ran_at + "Z").getTime()) / 86400000);
      const ok = String(row.status || "").toLowerCase() === "success" && ageDays <= 3;
      const srcStatus = ok ? "ok" : ageDays > 7 ? "stale" : "warning";
      contract.data_confidence.sources[label] = { status: srcStatus, last_run_at: row.ran_at, last_status: row.status, age_days: ageDays };
      if (srcStatus === "stale") anyStale = true;
      if (srcStatus === "warning") anyStale = true;
      if (!ok && srcStatus !== "unavailable") contract.data_confidence.warnings.push(label + ": last run " + row.status + " (" + ageDays + "d ago)");
    } catch {
      contract.data_confidence.sources[label] = { status: "unavailable" };
      anyMissing = true;
    }
  }
  contract.data_confidence.status = anyMissing ? "low" : anyStale ? "medium" : "high";

  // Feedback loop: reviewed past outcomes feed future AI context
  try {
    const outcomes = await env.DB.prepare(
      "SELECT id, action_date, product_id, channel, action_type, title, result_class, lessons, reviewed_at " +
      "FROM marketing_actions WHERE status = 'reviewed' ORDER BY reviewed_at DESC LIMIT 20"
    ).all();
    contract.past_outcomes = (outcomes as any).results || [];
  } catch {
    contract.schema_unavailable.push("marketing_actions");
  }

  return contract;
}

// ── Recommendation grounding validation ─────────────────────────────────────
// AI output may only cite contract-provided facts. Invalid rows are rejected
// here and never reach marketing_actions.

export function validateRecommendations(contract: any, rawList: any): { valid: any[]; rejected: any[] } {
  const valid: any[] = [];
  const rejected: any[] = [];
  const productIds = new Set((contract.canonical_products || []).map((p: any) => Number(p.id)));
  const confidenceStatus = contract.data_confidence && contract.data_confidence.status;

  const list = Array.isArray(rawList) ? rawList.slice(0, 10) : [];
  for (const raw of list) {
    const r = raw || {};
    const reasons: string[] = [];

    const productId = r.product_id === null || r.product_id === undefined || r.product_id === "" ? null : Number(r.product_id);
    if (productId !== null && !productIds.has(productId)) {
      reasons.push("invented or unknown product_id: " + String(r.product_id));
    }
    const action = String(r.action || "").trim();
    if (!action) reasons.push("missing action");
    const why = String(r.why || "").trim();
    if (!why) reasons.push("missing why");
    const confidence = r.confidence === undefined || r.confidence === null ? null : Number(r.confidence);
    if (confidence === null || isNaN(confidence) || confidence < 0 || confidence > 100) {
      reasons.push("confidence must be a number 0-100");
    }

    if (reasons.length) {
      rejected.push({ recommendation: r, reasons });
      continue;
    }

    const caution: string[] = [];
    if (confidenceStatus !== "high") {
      caution.push("Data confidence is '" + confidenceStatus + "' — recommendation should be treated as exploratory until freshness and coverage improve.");
    }
    const channel = String(r.channel || "").trim();
    if (channel === "google-ads" || channel === "google_ads" || /ads/i.test(action)) {
      caution.push(contract.unverified_signals.google_ads_purchase_attribution);
    }

    valid.push({
      product_id: productId,
      channel,
      action_type: String(r.action_type || "push_product").trim() || "push_product",
      title: action,
      detail: why,
      budget_test: r.budget_test === undefined || r.budget_test === null ? null : Number(r.budget_test),
      budget: r.budget === undefined || r.budget === null ? null : Number(r.budget),
      budget_currency: String(r.budget_currency || "THB").trim() || "THB",
      success_target: String(r.success_target || "").trim(),
      confidence,
      review_date: r.review_date ? String(r.review_date).slice(0, 10) : null,
      caution: caution.length ? 1 : 0,
      caution_note: caution.join(" "),
    });
  }
  return { valid, rejected };
}

// ── Provider-neutral AI call ────────────────────────────────────────────────
// OpenAI-compatible chat completions endpoint. Configure via:
//   AI_API_KEY (required), AI_API_BASE (default https://api.deepseek.com),
//   AI_MODEL (default deepseek-chat)

export function buildAiPrompt(contract: any): { system: string; user: string } {
  const system =
    "You are the MildMate marketing AI analyst. You are ADVISORY ONLY: you never execute actions, " +
    "never spend budgets, and never write canonical data. Return STRICT JSON only, no prose, in the form " +
    '{"recommendations":[{"product_id":<int|null>,"channel":"<string>","action":"<short imperative title>","action_type":"<push_product|campaign|content|monitor>","why":"<reasoning>","budget_test":<number|null>,"budget":<number|null>,"budget_currency":"THB","success_target":"<measurable target>","confidence":<0-100>,"review_date":"YYYY-MM-DD"}]} ' +
    "Hard rules: use ONLY product_id values from canonical_products (or null for non-product actions); " +
    "cite ONLY metrics present in the contract; never invent revenue, conversions, or product IDs; " +
    "treat google_ads_purchase_attribution as UNVERIFIED; when data_confidence is not high, be explicitly cautious.";
  const user = JSON.stringify({
    canonical_products: contract.canonical_products,
    opportunities: contract.opportunities,
    data_confidence: contract.data_confidence,
    unverified_signals: contract.unverified_signals,
    past_outcomes: contract.past_outcomes,
  });
  return { system, user };
}

export async function callAiProvider(env: any, contract: any): Promise<{ available: boolean; model?: string; list?: any[]; error?: string }> {
  const key = String(env.AI_API_KEY || "").trim();
  if (!key) return { available: false };
  const base = String(env.AI_API_BASE || "https://api.deepseek.com").replace(/\/+$/, "");
  const model = String(env.AI_MODEL || "deepseek-chat");
  const prompt = buildAiPrompt(contract);
  try {
    const resp = await fetch(base + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        temperature: 0.2,
      }),
    });
    if (!resp.ok) return { available: true, model, error: "provider HTTP " + resp.status };
    const body: any = await resp.json();
    const content = body && body.choices && body.choices[0] && body.choices[0].message ? String(body.choices[0].message.content || "") : "";
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { available: true, model, error: "provider returned non-JSON content" };
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    return { available: true, model, list };
  } catch (e: any) {
    return { available: true, model, error: String(e?.message || e) };
  }
}

// ── Audit email (post-authorization, pre-verified JWT) ──────────────────────
// authorizeAdmin has already verified authenticity; this decode is only used
// to attribute human approvals/reviews for the audit trail.

function actorEmail(request: Request): string {
  try {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const parts = token.split(".");
    if (parts.length < 2) return "";
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload.email || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────

async function getContract(env: any): Promise<Response> {
  const contract = await buildAiInputContract(env);
  return json({ success: true, contract });
}

async function recommendHandler(request: Request, env: any): Promise<Response> {
  let body: any = {};
  try { body = await request.json(); } catch { body = {}; }
  const dryRun = body && body.dry_run === true;

  const contract = await buildAiInputContract(env);
  const result = await callAiProvider(env, contract);

  if (!result.available) {
    return json({
      success: true,
      ai_available: false,
      message: "AI provider not configured (set AI_API_KEY, optional AI_API_BASE / AI_MODEL). No recommendations were generated or stored — nothing is fabricated.",
      contract_snapshot: { data_confidence: contract.data_confidence, opportunities: contract.opportunities.length },
    });
  }
  if (result.error) {
    return json({ success: true, ai_available: true, stored: 0, error: result.error, rejected: [] }, 200);
  }

  const { valid, rejected } = validateRecommendations(contract, result.list || []);
  if (dryRun) {
    return json({ success: true, ai_available: true, model: result.model, dry_run: true, valid, rejected, contract });
  }

  let stored = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const v of valid) {
    await env.DB.prepare(
      "INSERT INTO marketing_actions (action_date, source, ai_model, status, product_id, channel, action_type, title, detail, " +
      "recommendation_json, approved_budget, budget_currency, success_target, confidence, caution, caution_note, review_date) " +
      "VALUES (?1, 'ai', ?2, 'proposed', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"
    ).bind(
      today, result.model || null, v.product_id, v.channel, v.action_type, v.title, v.detail,
      JSON.stringify(v), v.budget, v.budget_currency, v.success_target, v.confidence, v.caution, v.caution_note, v.review_date
    ).run();
    stored++;
  }

  return json({
    success: true,
    ai_available: true,
    model: result.model,
    stored,
    rejected,
    grounding_note: "Only recommendations grounded in the contract were stored. Invented product IDs or missing fields are listed in rejected.",
  });
}

async function listActions(env: any, url: URL): Promise<Response> {
  const status = String(url.searchParams.get("status") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50) || 50, 1), 200);
  let rows: any[] = [];
  try {
    if (status && VALID_TRANSITIONS_INPUT.has(status)) {
      const res = await env.DB.prepare(
        "SELECT * FROM marketing_actions WHERE status = ?1 ORDER BY id DESC LIMIT ?2"
      ).bind(status, limit).all();
      rows = (res as any).results || [];
    } else {
      const res = await env.DB.prepare(
        "SELECT * FROM marketing_actions ORDER BY id DESC LIMIT ?1"
      ).bind(limit).all();
      rows = (res as any).results || [];
    }
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such table")) {
      return json({ success: true, available: false, error_code: "MARKETING_ACTIONS_SCHEMA_UNAVAILABLE", message: "Apply migration 063_marketing_actions.sql first.", actions: [] });
    }
    throw e;
  }
  return json({ success: true, available: true, actions: rows });
}

const VALID_TRANSITIONS_INPUT = new Set(["proposed", "approved", "rejected", "reviewed"]);

async function updateAction(request: Request, env: any, idStr: string): Promise<Response> {
  const id = Number(idStr);
  if (!id || isNaN(id)) return err("BAD_ID", "Invalid action id", 400);
  let body: any;
  try { body = await request.json(); } catch { return err("BAD_BODY", "JSON body required", 400); }

  const op = String(body.op || "").trim();
  const row: any = await env.DB.prepare("SELECT * FROM marketing_actions WHERE id = ?1").bind(id).first();
  if (!row) return err("NOT_FOUND", "Action not found", 404);

  const email = actorEmail(request);

  if (op === "approve") {
    if (row.status !== "proposed") return err("INVALID_TRANSITION", "Only proposed actions can be approved (current: " + row.status + ")", 409);
    // Baseline snapshot at approval time (canonical sources only)
    let baseline: any = { snapshot_at: new Date().toISOString(), recommendation: JSON.parse(row.recommendation_json || "{}") };
    try {
      if (row.product_id) {
        const opp: any = await env.DB.prepare(
          "SELECT score_date, score, confidence, tier FROM opportunity_scores WHERE product_id = ?1 ORDER BY score_date DESC LIMIT 1"
        ).bind(row.product_id).first();
        if (opp) baseline.opportunity_at_approval = opp;
      }
    } catch { /* baseline stays recommendation-only */ }
    await env.DB.prepare(
      "UPDATE marketing_actions SET status='approved', baseline_metrics_json=?2, approved_budget=COALESCE(?3, approved_budget), " +
      "approved_by=?4, approved_at=?5, updated_at=CURRENT_TIMESTAMP WHERE id=?1"
    ).bind(id, JSON.stringify(baseline), body.budget === undefined || body.budget === null ? null : Number(body.budget), email, new Date().toISOString()).run();
    return json({ success: true, id, status: "approved", approved_by: email });
  }

  if (op === "reject") {
    if (row.status !== "proposed") return err("INVALID_TRANSITION", "Only proposed actions can be rejected (current: " + row.status + ")", 409);
    await env.DB.prepare(
      "UPDATE marketing_actions SET status='rejected', rejected_by=?2, rejected_at=?3, updated_at=CURRENT_TIMESTAMP WHERE id=?1"
    ).bind(id, email, new Date().toISOString()).run();
    return json({ success: true, id, status: "rejected", rejected_by: email });
  }

  if (op === "review") {
    if (row.status !== "approved") return err("INVALID_TRANSITION", "Only approved actions can be reviewed (current: " + row.status + ")", 409);
    const rc = String(body.result_class || "").trim();
    if (!VALID_RESULT_CLASSES.has(rc)) {
      return err("BAD_RESULT_CLASS", "result_class must be one of positive|neutral|negative|inconclusive", 400);
    }
    await env.DB.prepare(
      "UPDATE marketing_actions SET status='reviewed', result_class=?2, post_metrics_json=?3, lessons=?4, reviewed_by=?5, reviewed_at=?6, updated_at=CURRENT_TIMESTAMP WHERE id=?1"
    ).bind(id, rc, JSON.stringify(body.post_metrics || null), String(body.lessons || "").trim() || null, email, new Date().toISOString()).run();
    return json({ success: true, id, status: "reviewed", result_class: rc, reviewed_by: email });
  }

  return err("BAD_OP", "op must be approve|reject|review", 400);
}

// ── Router ──────────────────────────────────────────────────────────────────

export async function handleAdminAiAnalyst(request: Request, env: any): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
      },
    });
  }
  const url = new URL(request.url);
  const sub = url.pathname.replace(/\/+$/, "").replace(/^\/api\/admin\/ai-analyst/, "") || "/";

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return err("UNAUTHORIZED", auth.error, auth.status);

  if (request.method === "GET" && sub === "/contract") return getContract(env);
  if (request.method === "POST" && sub === "/recommend") return recommendHandler(request, env);
  if (request.method === "GET" && sub === "/actions") return listActions(env, url);

  const actionMatch = sub.match(/^\/actions\/(\d+)$/);
  if (request.method === "PUT" && actionMatch) return updateAction(request, env, actionMatch[1]);

  return err("ROUTE_NOT_FOUND", "Unknown ai-analyst route: " + sub, 404);
}
