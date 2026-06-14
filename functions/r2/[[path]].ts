// R2 Asset Proxy — redirects uploaded product images to direct R2 public URL
// Old /r2/ prefix URLs are redirected to https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev/
export const onRequest: PagesFunction<{ MILDMATE_ASSETS: R2Bucket }> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.pathname.replace("/r2/", "");

  const R2_PUBLIC_BASE = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
  const publicUrl = `${R2_PUBLIC_BASE}/${key}`;

  // Try to serve from R2 binding first (pages.dev)
  try {
    const obj = await env.MILDMATE_ASSETS.get(key);
    if (obj) {
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch (_) {
    // R2 binding unavailable (e.g. on custom domain) — fall through to redirect
  }

  // R2 not available or object not found — redirect to R2 public URL
  return Response.redirect(publicUrl, 302);
};
