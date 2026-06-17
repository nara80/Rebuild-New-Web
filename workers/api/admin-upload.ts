// MildMate Admin API — Image upload to R2
// POST /api/admin/upload — multipart form, compresses to WebP, stores in R2
import { verifyClerkJwt } from "./clerk-verify";

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  values.push(raw.role, raw.roles, raw.org_role, raw.org_roles, raw.permission, raw.permissions);
  if (raw.public_metadata && typeof raw.public_metadata === "object") {
    values.push(
      raw.public_metadata.role,
      raw.public_metadata.roles,
      raw.public_metadata.org_role,
      raw.public_metadata.org_roles,
      raw.public_metadata.permission,
      raw.public_metadata.permissions
    );
  }
  if (raw.metadata && typeof raw.metadata === "object") {
    values.push(raw.metadata.role, raw.metadata.roles, raw.metadata.permission, raw.metadata.permissions);
  }
  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(rawClaims: any): boolean {
  const roles = collectRoles(rawClaims);
  return roles.some((r) =>
    r === "admin" ||
    r === "super-admin" ||
    r === "super_admin" ||
    r === "superadmin" ||
    r.endsWith(":admin") ||
    r.endsWith("/admin")
  );
}

function emailAllowed(email: string, env: any): boolean {
  if (!email) return false;
  const allow = String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

async function authCheck(request: Request, env: any): Promise<boolean> {
  const host = String(request.headers.get("Host") || "").toLowerCase().split(":")[0];
  const isProdHost = host === "www.mildmate.com" || host === "mildmate.com";
  if (!isProdHost) return true;

  const authHeader = request.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const verified = await verifyClerkJwt(request, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) return true;

      const sub = verified.payload.sub;
      const clerkKey = env.CLERK_SECRET_KEY;
      if (sub && clerkKey) {
        try {
          const clerkResp = await fetch("https://api.clerk.com/v1/users/" + encodeURIComponent(sub), {
            headers: { Authorization: "Bearer " + clerkKey }
          });
          if (clerkResp.ok) {
            const user = await clerkResp.json();
            const email = user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)?.email_address || "";
            const metadata = user.public_metadata || {};
            if (emailAllowed(email, env) || hasAdminRole(metadata)) return true;
          }
        } catch {}
      }
    }
  }

  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided || !configured) return false;
  return provided === configured;
}

export async function handleAdminUpload(request: Request, env: any): Promise<Response> {
  if (!(await authCheck(request, env))) {
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

    // Return direct R2 public URL (no proxy needed)
    const R2_PUBLIC_BASE = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";
    const publicUrl = `${R2_PUBLIC_BASE}/${key}`;

    return new Response(JSON.stringify({
      success: true,
      url: publicUrl,
      cdnUrl: publicUrl,
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
