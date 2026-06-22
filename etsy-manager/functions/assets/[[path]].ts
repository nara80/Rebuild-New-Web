interface Env {
  BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;

  if (!env.BUCKET) {
    return new Response("R2 Bucket binding missing", { status: 500 });
  }

  const pathArray = params.path as string[];
  const key = pathArray.join("/");

  try {
    const object = await env.BUCKET.get(key);

    if (!object) {
      return new Response("Asset Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000");

    return new Response(object.body, {
      headers
    });
  } catch (err: any) {
    return new Response(`Assets server error: ${err.message}`, { status: 500 });
  }
};
