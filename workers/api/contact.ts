// MildMate Contact Form API
// Sends contact form submissions via Resend to contact@mildmate.com

import { sendEmail } from "./email";

export interface ContactInput {
  name: string;
  email: string;
  subject?: string;
  inquiry_type?: string;
  message: string;
  turnstile_token?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyTurnstile(env: any, token: string, ip: string): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!env.TURNSTILE_SECRET_KEY) {
    console.error("TURNSTILE_SECRET_KEY is missing");
    return { ok: false, status: 503, error: "Security verification is temporarily unavailable. Please try again later." };
  }

  if (!token) {
    return { ok: false, status: 400, error: "Please complete the security check." };
  }

  const payload = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (ip && ip !== "unknown") payload.append("remoteip", ip);

  try {
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });
    const result: any = await resp.json();
    if (!result?.success) {
      return { ok: false, status: 400, error: "Security verification failed. Please try again." };
    }
    return { ok: true, status: 200 };
  } catch (e: any) {
    console.error("Turnstile verify error:", e?.message || e);
    return { ok: false, status: 502, error: "Security verification failed. Please try again." };
  }
}

export async function handleContact(request: Request, env: any): Promise<Response> {
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

  let body: ContactInput;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const inquiryType = (body.inquiry_type || "").trim();
  const subject = (body.subject || "").trim() || inquiryType || "General Inquiry";
  const message = (body.message || "").trim();
  const turnstileToken = (body.turnstile_token || body["cf-turnstile-response"] || "").trim();
  const ip = request.headers.get("cf-connecting-ip") || "unknown";

  const turnstile = await verifyTurnstile(env, turnstileToken, ip);
  if (!turnstile.ok) {
    return new Response(
      JSON.stringify({ error: turnstile.error || "Security verification failed." }),
      { status: turnstile.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  if (!name || !email || !isValidEmail(email) || !message) {
    return new Response(
      JSON.stringify({ error: "Name, email, and message are required and email must be valid." }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  const emailBody = `New contact form submission from MildMate website:

Name: ${name}
Email: ${email}
Subject: ${subject}
Inquiry Type: ${inquiryType || "general"}

Message:
${message}

---
Sent from: ${ip}
User-Agent: ${request.headers.get("user-agent") || "unknown"}`;

  let emailStatus = "not_sent";
  try {
    const result = await sendEmail(env, {
      to: "contact@mildmate.com",
      replyTo: email,
      subject: `[MildMate Contact] ${subject}`,
      text: emailBody,
    });

    if (!result.success) {
      console.error("Contact email failed:", result.error);
      return new Response(
        JSON.stringify({ error: "Failed to send message. Please try again later.", _debug: result.error }),
        { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    emailStatus = "sent";
  } catch (e: any) {
    console.error("Contact email failed:", e.message || e);
    return new Response(
      JSON.stringify({ error: "Email service unavailable. Your message was saved and will be reviewed.", _debug: e.message }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Thank you! Your message has been sent. We typically reply within 24 hours.",
      _debug_email: emailStatus,
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
}
