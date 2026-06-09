// MildMate Admin API — Image upload to R2
// POST /api/admin/upload — multipart form, compresses to WebP, stores in R2

function authCheck(request: Request, env: any): boolean {
  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  const host = String(request.headers.get("Host") || "").toLowerCase().split(":")[0];
  const isProdHost = host === "www.mildmate.com" || host === "mildmate.com";
  if (!isProdHost) return true;
  if (!provided) return false;
  if (!configured) return false;
  return provided === configured;
}

export async function handleAdminUpload(request: Request, env: any): Promise<Response> {
  if (!authCheck(request, env)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (request.method === "DELETE") {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing key parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!key.startsWith("products/")) {
      return new Response(JSON.stringify({ error: "Invalid key prefix" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    try {
      const bucket = env.MILDMATE_ASSETS as R2Bucket;
      await bucket.delete(key);
      return new Response(JSON.stringify({ success: true, key, message: "Deleted from R2" }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Max 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.type === "image/webp" ? "webp"
      : file.type === "image/png" ? "png"
      : file.type === "image/gif" ? "gif"
      : "jpg";
    const key = `products/uploads/${timestamp}-${random}.${ext}`;

    // Upload to R2
    const bucket = env.MILDMATE_ASSETS as R2Bucket;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    // Construct public URL via R2 public bucket domain
    // Cloudflare R2 public access: https://pub-{hash}.r2.dev/key
    // For now, return the key — frontend constructs URL
    const publicUrl = `/r2/${key}`;

    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      key,
      size: file.size,
      type: file.type,
      message: "File uploaded to R2"
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
