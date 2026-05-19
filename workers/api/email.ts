// MildMate shared email helper — uses Resend REST API
// Requires RESEND_API_KEY secret set via: npx wrangler pages secret put RESEND_API_KEY
// Domain must be verified at https://resend.com/domains
// Uses direct fetch() — no SDK dependencies, works natively in Cloudflare Workers

export async function sendEmail(env: any, options: {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MildMate <noreply@mildmate.com>",
        to: [options.to],
        reply_to: options.replyTo,
        subject: options.subject,
        text: options.text,
      }),
    });

    const body = await resp.json() as any;

    if (!resp.ok) {
      console.error("Resend API error:", resp.status, JSON.stringify(body));
      return { success: false, error: body?.message || `HTTP ${resp.status}` };
    }

    return { success: true, id: body?.id };
  } catch (err: any) {
    console.error("Resend fetch failed:", err.message || err);
    return { success: false, error: err.message || "Network error" };
  }
}
