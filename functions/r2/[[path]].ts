// R2 Asset Proxy — serves uploaded product images at /r2/*
export const onRequest: PagesFunction<{ MILDMATE_ASSETS: R2Bucket }> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.pathname.replace("/r2/", "");

  const obj = await env.MILDMATE_ASSETS.get(key);
  if (obj) {
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }
  return new Response("Not Found", { status: 404 });
};
