interface Env {
  ETSY_CLIENT_ID: string;
  ETSY_CLIENT_SECRET: string;
  ETSY_REDIRECT_URI: string;
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    return new Response("Missing authorization code in callback.", { status: 400 });
  }

  // Retrieve code_verifier from cookies
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map(c => c.trim().split("="))
  );
  const codeVerifier = cookies["etsy_verifier"];

  if (!codeVerifier) {
    return new Response("Missing code verifier cookie (expired or invalid session).", { status: 400 });
  }

  const clientId = env.ETSY_CLIENT_ID;
  const clientSecret = env.ETSY_CLIENT_SECRET;
  const redirectUri = env.ETSY_REDIRECT_URI;

  // Build the form body for token exchange
  const bodyParams = new URLSearchParams();
  bodyParams.append("grant_type", "authorization_code");
  bodyParams.append("client_id", clientId);
  if (clientSecret) {
    bodyParams.append("client_secret", clientSecret);
  }
  bodyParams.append("redirect_uri", redirectUri);
  bodyParams.append("code", code);
  bodyParams.append("code_verifier", codeVerifier);

  try {
    const tokenRes = await fetch("https://api.etsy.com/v3/public/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: bodyParams.toString()
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Failed to exchange token: ${errBody}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    // Save tokens in D1 database
    await env.DB.prepare(
      `INSERT OR REPLACE INTO etsy_auth (id, access_token, refresh_token, expires_at) 
       VALUES (1, ?, ?, ?)`
    )
      .bind(tokenData.access_token, tokenData.refresh_token, expiresAt)
      .run();

    // Redirect to dashboard, clear verifier cookie
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/index.html",
        "Set-Cookie": "etsy_verifier=; Path=/; Max-Age=0"
      }
    });
  } catch (error: any) {
    return new Response(`Authentication Callback Error: ${error.message}`, { status: 500 });
  }
};
