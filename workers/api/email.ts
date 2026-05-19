// MildMate shared email helper — uses Resend
// Requires RESEND_API_KEY secret set via: npx wrangler pages secret put RESEND_API_KEY
// Domain must be verified at https://resend.com/domains

import { Resend } from "resend";

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

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: "MildMate <noreply@mildmate.com>",
    to: [options.to],
    replyTo: options.replyTo,
    subject: options.subject,
    text: options.text,
  });

  if (error) {
    console.error("Resend error:", error.name, error.message);
    return { success: false, error: error.message };
  }

  return { success: true, id: data?.id };
}
