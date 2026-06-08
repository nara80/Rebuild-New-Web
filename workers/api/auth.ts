// MildMate Auth API — Clerk JWT verification
// GET /api/auth/me — returns current user profile (or {authenticated:false} for guests)

import { verifyClerkJwt } from "./clerk-verify";

export async function handleAuth(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /api/auth/me — user profile
  if (request.method === "GET" && (path === "/api/auth/me" || path === "/api/auth/me/")) {
    const authHeader = request.headers.get("Authorization") || "";

    // No token — return unauthenticated (guest checkout still works)
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ authenticated: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify Clerk JWT
    const result = await verifyClerkJwt(request, env);
    if (!result.valid) {
      // If token is expired/invalid, return unauthenticated rather than error
      if (result.status === 401) {
        return new Response(JSON.stringify({ authenticated: false }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: result.error }), {
        status: result.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { payload } = result;
    // Clerk JWT may not contain email for Google/Facebook OAuth — fallback to X-User-Email header from frontend SDK
    const headerEmail = request.headers.get("X-User-Email") || "";
    const email = payload.email || headerEmail || "";
    const name = payload.name || headerEmail.split("@")[0] || "";

    // Upsert customer record
    try {
      await env.DB.prepare(
        `INSERT INTO customers (email, name, auth_provider, auth_provider_id, created_at)
         VALUES (?1, ?2, 'clerk', ?3, datetime('now'))
         ON CONFLICT(email) DO UPDATE SET name = ?2, auth_provider_id = ?3`
      ).bind(email, name, payload.sub).run();
    } catch {
      // customers table may not exist yet — non-critical
    }

    return new Response(JSON.stringify({
      authenticated: true,
      email,
      name,
      sub: payload.sub,
      provider: "clerk",
    }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
