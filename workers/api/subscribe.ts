// MildMate Subscribe API
// Phase 4: Accepts email signup from homepage/footer form
// Phase 5+: Will issue discount codes and validate at checkout

export interface SubscribeInput {
  email: string;
  source?: string;      // 'homepage' | 'footer' | 'popup'
  language?: string;    // 'en' | 'th'
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

  const email = (body.email || "").trim().toLowerCase();
  const source = (body.source || "homepage").trim().toLowerCase();
  const language = (body.language || "en").trim().toLowerCase();

  if (!email || !isValidEmail(email)) {
    return new Response(
      JSON.stringify({ error: "A valid email address is required." }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const db = env.DB as D1Database;

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

    // Check if it was actually inserted or ignored
    const existing = await db
      .prepare(`SELECT id, created_at FROM subscribers WHERE email = ?`)
      .bind(email)
      .first<{ id: number; created_at: string }>();

    const isNew = existing !== null;

    return new Response(
      JSON.stringify({
        success: true,
        message: isNew
          ? "Thanks for subscribing! Check your inbox for a welcome email."
          : "You're already on our list — welcome back!",
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
