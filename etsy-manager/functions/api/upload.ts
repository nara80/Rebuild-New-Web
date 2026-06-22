interface Env {
  BUCKET: R2Bucket;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  const filename = url.searchParams.get("filename") || "image.jpg";
  const contentType = request.headers.get("Content-Type") || "image/jpeg";

  if (!env.BUCKET) {
    return new Response(
      JSON.stringify({ error: "Cloudflare R2 Bucket 'BUCKET' binding is missing" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  // Define unique key name
  const key = `etsy-images/${Date.now()}-${filename}`;

  try {
    // Put file into R2 bucket
    await env.BUCKET.put(key, request.body, {
      httpMetadata: { contentType }
    });

    return new Response(
      JSON.stringify({ url: `/assets/${key}` }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
