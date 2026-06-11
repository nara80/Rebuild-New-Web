// ─── Admin Templates API ────────────────────────────────────────────────────
// GET  /api/admin/templates     → list all templates
// PUT  /api/admin/templates     → update template (body: { key, html })

import { getAllTemplates, updateTemplate } from "../shared/chrome";
import { authorizeAdmin } from "./clerk-verify";

export async function handleAdminTemplates(request: Request, env: any): Promise<Response> {
  const auth = await authorizeAdmin(request, env);
  if (auth) return auth;

  const method = request.method.toUpperCase();

  if (method === "GET") {
    const templates = await getAllTemplates(env.DB);
    return new Response(JSON.stringify({ templates }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "PUT") {
    let body: { key: string; html: string };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.key || !body.html) {
      return new Response(JSON.stringify({ error: "Missing key or html" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const allowed = ["header-standard", "footer-standard"];
    if (!allowed.includes(body.key)) {
      return new Response(JSON.stringify({ error: `Invalid template key. Allowed: ${allowed.join(", ")}` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await updateTemplate(env.DB, body.key, body.html);
    return new Response(JSON.stringify({ ok: true, key: body.key }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
