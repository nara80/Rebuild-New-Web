interface Env {
  ADMIN_PASSPHRASE: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Retrieve cookie header
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(c => c.trim().split("="))
  );

  const adminPassphrase = (env.ADMIN_PASSPHRASE || "mildmate-admin-secret").trim();



  // Allow static assets, login page, and authentication endpoints freely

  // Allow static assets, login page, and authentication endpoints freely
  if (
    url.pathname === "/login.html" ||
    url.pathname === "/login" ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/css/") ||
    url.pathname.startsWith("/js/") ||
    url.pathname === "/favicon.ico"
  ) {
    return next();
  }

  const isAuthenticated = decodeURIComponent((cookies["admin_auth"] || "").trim()) === adminPassphrase;

  if (!isAuthenticated) {
    // If requesting API, return JSON error
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    // Otherwise redirect to the login page with an error flag
    return Response.redirect(`${url.origin}/login.html?error=unauthorized`, 302);
  }

  return next();
};
