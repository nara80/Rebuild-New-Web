import { verifyClerkJwt } from "./clerk-verify";

function isProductionHost(hostname: string): boolean {
  const h = String(hostname || "").toLowerCase();
  return h === "www.mildmate.com" || h === "mildmate.com" || h.endsWith(".mildmate.com");
}

function hasAdminRole(raw: any): boolean {
  if (!raw) return false;
  const candidates: any[] = [];
  if (raw.role) candidates.push(raw.role);
  if (raw.roles) candidates.push(raw.roles);
  if (raw.public_metadata?.role) candidates.push(raw.public_metadata.role);
  if (raw.publicMetadata?.role) candidates.push(raw.publicMetadata.role);
  if (raw.metadata?.role) candidates.push(raw.metadata.role);
  if (raw.organization_role) candidates.push(raw.organization_role);
  if (raw.org_role) candidates.push(raw.org_role);
  const flat: string[] = [];
  for (const c of candidates) {
    if (Array.isArray(c)) flat.push(...c.map(String));
    else if (typeof c === "string") flat.push(c);
  }
  return flat.some((v) => {
    const r = String(v).toLowerCase();
    return r === "admin" || r === "super-admin" || r === "super_admin" || r === "superadmin" || r.endsWith(":admin") || r.endsWith("/admin");
  });
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const hostname = request.headers.get("Host") || "";
  if (!isProductionHost(hostname)) return { ok: true };

  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (!verified.valid) return { ok: false, status: verified.status, error: verified.error };
    const raw = (verified as any).payload?.raw || {};
    if (hasAdminRole(raw)) return { ok: true };
    const jwtEmail = String(raw.email || (verified as any).payload?.email || "").trim().toLowerCase();
    const allow = String(env.ADMIN_EMAILS || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    if (jwtEmail && allow.includes(jwtEmail)) return { ok: true };
    return { ok: false, status: 403, error: "Forbidden: admin role required" };
  }

  const providedSecret = (request.headers.get("X-Admin-Secret") || "").trim();
  const expectedSecret = String(env.ADMIN_SECRET || "").trim();
  if (providedSecret && expectedSecret && providedSecret === expectedSecret) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
}

async function sendThankyouEmail(env: any, to: string, discountCode: string, discountPct: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.ORDER_FROM_EMAIL || "MildMate <orders@mildmate.com>",
        to: [to],
        subject: `Thank you — here's ${discountPct}% off your next MildMate order`,
        html: `<!doctype html><html><body style="font-family:Arial,sans-serif"><h2>Thank you for your order</h2><p>Here is your repeat-buyer discount code:</p><p style="font-size:22px;font-weight:700">${discountCode}</p><p>${discountPct}% off your next order (valid for 1 year).</p><p><a href="https://www.mildmate.com/">Shop MildMate</a></p></body></html>`,
      }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { ok: false, error: body || `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "send failed" };
  }
}

async function ensureThankyouQueueSchema(env: any): Promise<void> {
  try {
    const tableInfo = await env.DB.prepare("PRAGMA table_info(thankyou_queue)").all();
    const cols = new Set(((tableInfo?.results || []) as any[]).map((r: any) => String(r.name || "").toLowerCase()));
    if (!cols.has("sent_at")) {
      await env.DB.prepare("ALTER TABLE thankyou_queue ADD COLUMN sent_at DATETIME").run();
    }
    if (!cols.has("last_error")) {
      await env.DB.prepare("ALTER TABLE thankyou_queue ADD COLUMN last_error TEXT").run();
    }
  } catch {}
}

export async function handleAdminThankyouDispatch(request: Request, env: any): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers });
  if (!env.RESEND_API_KEY) return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500, headers });
  await ensureThankyouQueueSchema(env);

  let limit = 50;
  try {
    const body = await request.json() as any;
    const n = Number(body?.limit || 50);
    if (Number.isFinite(n)) limit = Math.max(1, Math.min(200, Math.floor(n)));
  } catch {}

  const { results } = await env.DB.prepare(
    "SELECT id, order_id, email, discount_code, discount_pct, send_after FROM thankyou_queue WHERE sent = 0 AND send_after <= datetime('now') ORDER BY send_after ASC LIMIT ?1"
  ).bind(limit).all();
  const queue = (results || []) as any[];

  let sent = 0;
  let failed = 0, skipped = 0;
  const errors: string[] = [];
  const sentItems: any[] = [];
  const failedItems: any[] = [];
  const skippedItems: any[] = [];
  const sentEmails: string[] = [];
  const failedEmails: string[] = [];
  const skippedEmails: string[] = [];
  const handledEmails = new Set<string>();

  for (const row of queue) {
    const queueId = Number(row.id || 0);
    const orderId = String(row.order_id || "");
    const email = String(row.email || "").trim().toLowerCase();
    const code = String(row.discount_code || "").trim();
    const pct = Number(row.discount_pct || 20);

    if (!email || !code) {
      skipped++;
      skippedItems.push({ id: queueId, order_id: orderId, email, reason: "missing_email_or_code" });
      if (email) skippedEmails.push(email);
      await env.DB.prepare("UPDATE thankyou_queue SET sent = 1, sent_at = datetime('now'), last_error = ?1 WHERE id = ?2").bind("skipped_missing_email_or_code", queueId).run();
      continue;
    }

    const claim = await env.DB.prepare(
      "SELECT status, expires_at FROM discount_claims WHERE code = ?1 AND email = ?2 AND source = 'thankyou' LIMIT 1"
    ).bind(code, email).first() as any;

    if (!claim) {
      skipped++;
      skippedItems.push({ id: queueId, order_id: orderId, email, reason: "missing_discount_claim" });
      skippedEmails.push(email);
      await env.DB.prepare("UPDATE thankyou_queue SET sent = 1, sent_at = datetime('now'), last_error = ?1 WHERE id = ?2").bind("skipped_missing_discount_claim", queueId).run();
      continue;
    }

    const claimStatus = String(claim.status || "").toLowerCase();
    const expired = claim.expires_at ? String(claim.expires_at) <= new Date().toISOString().replace("T", " ").slice(0, 19) : false;
    if (claimStatus !== "issued" || expired) {
      skipped++;
      skippedItems.push({ id: queueId, order_id: orderId, email, reason: "inactive_or_expired_code" });
      skippedEmails.push(email);
      await env.DB.prepare("UPDATE thankyou_queue SET sent = 1, sent_at = datetime('now'), last_error = ?1 WHERE id = ?2").bind("skipped_inactive_or_expired_code", queueId).run();
      continue;
    }

    if (handledEmails.has(email)) {
      skipped++;
      skippedItems.push({ id: queueId, order_id: orderId, email, reason: "duplicate_email_in_batch" });
      skippedEmails.push(email);
      await env.DB.prepare("UPDATE thankyou_queue SET sent = 1, sent_at = datetime('now'), last_error = ?1 WHERE id = ?2").bind("skipped_duplicate_email_in_batch", queueId).run();
      continue;
    }

    handledEmails.add(email);
    const rs = await sendThankyouEmail(env, email, code, pct);
    if (rs.ok) {
      await env.DB.prepare("UPDATE thankyou_queue SET sent = 1, sent_at = datetime('now'), last_error = NULL WHERE id = ?1").bind(queueId).run();
      sent++;
      sentEmails.push(email);
      if (sentItems.length < 30) sentItems.push({ id: queueId, order_id: orderId, email, code, discount_pct: pct });
    } else {
      failed++;
      const err = rs.error || "unknown error";
      failedEmails.push(email);
      await env.DB.prepare("UPDATE thankyou_queue SET last_error = ?1 WHERE id = ?2").bind(err.slice(0, 500), queueId).run();
      if (failedItems.length < 30) failedItems.push({ id: queueId, order_id: orderId, email, code, error: err });
      if (errors.length < 10) errors.push(`id ${queueId}: ${err}`);
    }
  }

  return new Response(JSON.stringify({
    processed: queue.length,
    sent,
    failed,
    skipped,
    remaining_due: Math.max(0, queue.length - sent),
    errors,
    sent_items: sentItems,
    failed_items: failedItems,
    skipped_items: skippedItems,
    sent_emails: sentEmails,
    failed_emails: failedEmails,
    skipped_emails: skippedEmails,
  }), { headers });
}
