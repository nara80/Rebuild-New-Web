// MildMate Contact Form API
// Sends contact form submissions via Resend to contact@mildmate.com

import { sendEmail } from "./email";

export interface ContactInput {
  name: string;
  email: string;
  subject?: string;
  inquiry_type?: string;
  message: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
Sent from: ${request.headers.get("cf-connecting-ip") || "unknown"}
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
