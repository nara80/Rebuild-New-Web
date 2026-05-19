// MildMate Subscribe API
// Phase 4: Accepts email signup from homepage/footer form
// Phase 5+: Will issue discount codes and validate at checkout
// Anti-spam: honeypot field + IP rate limit (5/hour)

export interface SubscribeInput {
  email: string;
  source?: string;      // 'homepage' | 'footer' | 'popup'
  language?: string;    // 'en' | 'th'
  _website?: string;    // honeypot
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const SUBSCRIBE_RATE_LIMIT = 5;

export async function handleSubscribe(request: Request, env: any): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  let body: SubscribeInput;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // ── Honeypot check — bots auto-fill hidden fields ──
  if (body._website && body._website.length > 0) {
    return new Response(
      JSON.stringify({ success: true, message: "Thanks for subscribing!" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // ── IP rate limit ──
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const db = env.DB as D1Database;
  const rateRow = await db.prepare(
    `SELECT COUNT(*) as cnt FROM rate_limits WHERE ip_address = ? AND endpoint = 'subscribe' AND created_at > datetime('now', '-1 hour')`
  ).bind(ip).first();
  if ((rateRow?.cnt || 0) >= SUBSCRIBE_RATE_LIMIT) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const email = (body.email || "").trim().toLowerCase();
  const source = (body.source || "homepage").trim().toLowerCase();
  const language = (body.language || "en").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return new Response(
      JSON.stringify({ error: "A valid email address is required." }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    // Insert subscriber — D1 UNIQUE constraint on email prevents duplicates.
    // ON CONFLICT IGNORE lets us silently swallow re-subscriptions.
    await db
      .prepare(
        `INSERT OR IGNORE INTO subscribers (email, source, language, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(email, source, language)
      .run();

    // Record rate limit entry
    await db.prepare(
      `INSERT INTO rate_limits (ip_address, endpoint) VALUES (?, 'subscribe')`
    ).bind(ip).run();

    // Check if it was actually inserted or ignored
    const existing = await db
      .prepare(`SELECT id, created_at FROM subscribers WHERE email = ?`)
      .bind(email)
      .first<{ id: number; created_at: string }>();

    const isNew = existing !== null;

    const msgNew = language === 'th'
      ? "ขอบคุณที่สมัคร! ตรวจสอบอีเมลต้อนรับในกล่องจดหมายของคุณ ยกเลิกการสมัครได้ตลอดเวลาที่ mildmate.com/unsubscribe/"
      : "Thanks for subscribing! Check your inbox for a welcome email. You can unsubscribe anytime at mildmate.com/unsubscribe/.";

    const msgExisting = language === 'th'
      ? "คุณอยู่ในรายชื่ออยู่แล้ว — ยินดีต้อนรับกลับ! ยกเลิกการสมัครได้ตลอดเวลาที่ mildmate.com/unsubscribe/"
      : "You're already on our list — welcome back! Unsubscribe anytime at mildmate.com/unsubscribe/.";

    return new Response(
      JSON.stringify({
        success: true,
        message: isNew ? msgNew : msgExisting,
        email,
        new_subscriber: isNew,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message || "Database error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}
