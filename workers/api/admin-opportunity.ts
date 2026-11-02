// MildMate Admin API — Opportunity Engine (Phase 14)
//
// GET  /api/admin/analysis/opportunity           → latest stored score snapshot (read-only, never recomputes)
// POST /api/admin/analysis/opportunity/recompute → recompute now ({dry_run:true} optional preview)
//
// The scoring logic lives in the shared core ../../scripts/opportunity-core.mjs
// (also imported by the marketing-sync-worker weekly cron). This module is a
// thin API shell: no scoring logic is ever forked between runtimes.
//
// Rules (Phase 14 Metric Contract extension):
//   Dashboard first view reads stored scores only — no writes, no recompute.
//   Manual recompute is deterministic + idempotent: same-day rerun replaces
//   that day's snapshot (UNIQUE score_date + model + product + channel).
//   Missing components are never zero; rows carry available_weight, missing
//   flags, confidence, and a human-readable reason.

// @ts-ignore — shared plain-JS core module (no type declarations by design)
import { recomputeOpportunityScores, loadModel } from "../../scripts/opportunity-core.mjs";

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

// ── GET: latest stored snapshot ─────────────────────────────────────────────

export async function getOpportunity(env: any): Promise<Response> {
  const model = await loadModel(env);

  let latest: any = null;
  try {
    latest = await env.DB.prepare(
      "SELECT score_date, computed_at, COUNT(*) AS rows_n, " +
      "SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS scored_n, " +
      "SUM(CASE WHEN score IS NULL THEN 1 ELSE 0 END) AS insufficient_n " +
      "FROM opportunity_scores WHERE score_model_version = ?1 " +
      "GROUP BY score_date ORDER BY score_date DESC LIMIT 1"
    ).bind(model.model_version).first();
  } catch {
    latest = null; // table missing (migration 054 not applied)
  }

  let rows: any[] = [];
  if (latest) {
    const res = await env.DB.prepare(
      "SELECT o.product_id, p.slug, p.title_en, o.channel, o.score, o.rank, o.tier, o.confidence, " +
      "o.components_json, o.available_weight, o.missing_components, o.reasons " +
      "FROM opportunity_scores o JOIN products p ON p.id = o.product_id " +
      "WHERE o.score_model_version = ?1 AND o.score_date = ?2 " +
      "ORDER BY CASE WHEN o.channel = '' THEN 0 ELSE 1 END, o.channel, o.rank, o.product_id"
    ).bind(model.model_version, latest.score_date).all();
    rows = (res as any).results || [];
  }

  const overall = rows.filter((r: any) => r.channel === "");
  const byChannel = rows.filter((r: any) => r.channel !== "");

  return json({
    success: true,
    model_version: model.model_version,
    weights: model.weights,
    latest_score_date: latest ? latest.score_date : null,
    computed_at: latest ? latest.computed_at : null,
    row_counts: latest ? { total: latest.rows_n, scored: latest.scored_n, insufficient: latest.insufficient_n } : null,
    note: "Scores are normalized per available component weight (missing components never count as zero). Profitability is MODELED margin (Phase 13 formula-derived, ESTIMATED) — never realized per-product margin. Tier grades the score (HIGH >=70, MEDIUM >=45, LOW >=25) and is issued only when confidence >= 25; otherwise INSUFFICIENT_DATA (no score).",
    overall,
    by_channel: byChannel,
  });
}

// ── POST: recompute now (admin-triggered; cron uses the same core) ─────────

export async function recomputeOpportunityHandler(request: Request, env: any): Promise<Response> {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = {}; // empty body is fine
  }
  const dryRun = body && body.dry_run === true;

  try {
    const report = await recomputeOpportunityScores(env, { dryRun });
    return json({ success: true, ...report });
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes("no such table") || msg.includes("no such view")) {
      return err("OPPORTUNITY_VIEWS_MISSING", "Opportunity engine inputs not found — apply migrations 042/046/048/053/054 first.", 500);
    }
    return err("RECOMPUTE_FAILED", msg, 500);
  }
}
