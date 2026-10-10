// MildMate shared email helper — uses Resend REST API
// Requires RESEND_API_KEY secret set via: npx wrangler pages secret put RESEND_API_KEY
// Domain must be verified at https://resend.com/domains
// Uses direct fetch() — no SDK dependencies, works natively in Cloudflare Workers

const PROD_LABELS = new Set(["prod", "production", "live"]);

function normalize(v: any): string {
  return String(v || "").trim().toLowerCase();
}

export function evaluateOutboundEmailSafety(env: any): { allowed: boolean; mode: "production" | "non_production" | "unknown"; reason: string } {
  const runtimeEnv = normalize(env.RUNTIME_ENV || env.APP_ENV);
  const d1EnvLabel = normalize(env.D1_ENV_LABEL);
  const stripeEnvMode = normalize(env.STRIPE_ENV_MODE);
  const nonProdEmailAllowed = normalize(env.NON_PROD_EMAIL_ALLOWED);

  const runtimeIsProd = !!runtimeEnv && PROD_LABELS.has(runtimeEnv);
  const d1IsProd = !!d1EnvLabel && PROD_LABELS.has(d1EnvLabel);
  const stripeIsProd = stripeEnvMode === "live";

  const runtimeIsNonProd = !!runtimeEnv && !PROD_LABELS.has(runtimeEnv);
  const d1IsNonProd = !!d1EnvLabel && !PROD_LABELS.has(d1EnvLabel);
  const stripeIsNonProd = stripeEnvMode === "test";

  const hasProdSignal = runtimeIsProd || d1IsProd || stripeIsProd;
  const hasNonProdSignal = runtimeIsNonProd || d1IsNonProd || stripeIsNonProd;

  if (hasNonProdSignal && nonProdEmailAllowed === "false") {
    return { allowed: false, mode: "non_production", reason: "non_prod_email_explicitly_blocked" };
  }

  if (hasProdSignal && hasNonProdSignal) {
    return { allowed: false, mode: "unknown", reason: "environment_signal_conflict" };
  }

  if (hasNonProdSignal) {
    if (nonProdEmailAllowed === "true") {
      return { allowed: true, mode: "non_production", reason: "non_prod_opt_in" };
    }
    if (nonProdEmailAllowed === "false") {
      return { allowed: false, mode: "non_production", reason: "non_prod_email_explicitly_blocked" };
    }
    if (!nonProdEmailAllowed) {
      return { allowed: false, mode: "non_production", reason: "missing_non_prod_email_allowed" };
    }
    return { allowed: false, mode: "non_production", reason: "malformed_non_prod_email_allowed" };
  }

  if (hasProdSignal) {
    return { allowed: true, mode: "production", reason: "production_mode" };
  }

  // Compatibility fallback: preserve existing behavior in environments without explicit
  // runtime labels. Staging/preview deployments must provide non-prod signals.
  return { allowed: true, mode: "unknown", reason: "legacy_unclassified_mode" };
}

export async function sendEmail(env: any, options: {
  to: string;
  replyTo?: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const safety = evaluateOutboundEmailSafety(env);
  if (!safety.allowed) {
    console.warn(`Email suppressed: ${safety.reason}`);
    return { success: false, error: `EMAIL_SUPPRESSED:${safety.reason}` };
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not set");
    throw new Error("RESEND_API_KEY not configured");
  }

  try {
    const from = options.from || env.ORDER_FROM_EMAIL || "MildMate <noreply@mildmate.com>";
    const payload: Record<string, any> = {
      from,
      to: [options.to],
      reply_to: options.replyTo,
      subject: options.subject,
      text: options.text,
    };
    // Only attach HTML when explicitly provided. Resend treats omitted html as plain text only.
    if (options.html && options.html.trim().length > 0) {
      payload.html = options.html;
    }
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
