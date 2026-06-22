interface Env {
  ETSY_CLIENT_ID: string;
  ETSY_REDIRECT_URI: string;
}

function base64url(buf: Uint8Array | ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function generateCodeChallenge(verifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(digest);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const clientId = env.ETSY_CLIENT_ID;
  const redirectUri = env.ETSY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return new Response("Missing ETSY_CLIENT_ID or ETSY_REDIRECT_URI in environment.", { status: 500 });
  }

  // 1. Generate code_verifier
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const codeVerifier = base64url(verifierBytes);

  // 2. Generate code_challenge
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // 3. Build authorization URL
  const state = "mildmate-etsy-oauth";
  const scopes = "listings_w listings_r profile_r shops_r email_r";
  
  const authUrl = `https://www.etsy.com/oauth/connect` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`;

  // 4. Return redirect and set code_verifier in secure cookie
  return new Response(null, {
    status: 302,
    headers: {
      "Location": authUrl,
      "Set-Cookie": `etsy_verifier=${codeVerifier}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
    }
  });
};
