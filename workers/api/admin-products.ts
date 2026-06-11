// MildMate Admin API — Product editing
// GET  /api/admin/products          — list all products
// POST /api/admin/products          — create new product
// GET  /api/admin/products/:slug    — get single product
// PUT  /api/admin/products/:slug    — update product fields

interface ProductRow {
  id: number;
  slug: string;
  title_en: string;
  title_th: string | null;
  description_en: string | null;
  description_th: string | null;
  category: string;
  product_type: string | null;
  niches: string | null;
  subcategory: string | null;
  fabric_options: string | null;
  base_price_usd: number | null;
  base_price_thb: number | null;
  is_custom: number;
  image_url: string | null;
  tags: string | null;
  youtube_url: string | null;
  images: string | null;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// Helper: parse category CSV to extract product_type + niches
function parseCategoryCsv(csv: string): { product_type: string; niches: string } {
  const parts = csv.split(',').map(s => s.trim()).filter(Boolean);
  const product_type = parts[0] || 'sheets';
  const niches = parts.slice(1).join(', ');
  return { product_type, niches };
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}
const ADMIN_SECRET_ERROR = JSON.stringify({ error: "Unauthorized" });

function authCheck(request: Request, env: any): boolean {
  const hostname = request.headers.get("Host") || "";
  const prodHost = isProductionHost(hostname);
  if (!prodHost) return true;
  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided) return false;
  if (!configured) return false;
  return provided === configured;
}

export async function handleAdminProducts(request: Request, env: any): Promise<Response> {
  if (!authCheck(request, env)) {
    return new Response(ADMIN_SECRET_ERROR, {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, ""); // strip trailing slash
  const method = request.method;

  // GET /api/admin/products — list all
  if (method === "GET" && path === "/api/admin/products") {
    const db = env.DB as D1Database;
    const result = await db.prepare(
      `SELECT id, slug, title_en, title_th, description_en, description_th,
              category, product_type, niches, subcategory, fabric_options, base_price_usd, base_price_thb,
              is_custom, image_url, tags, youtube_url, images, sort_order, is_active
       FROM products ORDER BY sort_order, id`
    ).all();

    return new Response(JSON.stringify(result.results || []), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // POST /api/admin/products — create new product
  if (method === "POST" && path === "/api/admin/products") {
    const db = env.DB as D1Database;
    try {
      const body: any = await request.json();
      const slug = body.slug;
      if (!slug) {
        return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      // Check slug uniqueness
      const dup = await db.prepare("SELECT id FROM products WHERE slug = ?").bind(slug).first();
      if (dup) {
        return new Response(JSON.stringify({ error: "Slug already exists" }), { status: 409, headers: { "Content-Type": "application/json" } });
      }
      // Parse product_type + niches from category CSV
      const { product_type, niches } = parseCategoryCsv(body.category || "sheets");

      await db.prepare(
        `INSERT INTO products (slug, title_en, title_th, description_en, description_th, category, product_type, niches, fabric_options, image_url, youtube_url, images, tags, is_custom, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 99)`
      ).bind(
        slug,
        body.title_en || body.titleEN || slug,
        body.title_th || body.titleTH || null,
        body.description_en || body.descEN || null,
        body.description_th || body.descTH || null,
        body.category || "sheets",
        body.product_type || product_type,
        body.niches || niches,
        body.fabric_options || null,
        body.image_url || null,
        body.youtube_url || body.video || null,
        body.images || "[]",
        body.tags || null
      ).run();
      return new Response(JSON.stringify({ success: true, slug }), { headers: { "Content-Type": "application/json" } });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }

  // GET /api/admin/products/:slug
  const slugMatch = path.match(/^\/api\/admin\/products\/(.+)$/);
  if (slugMatch && method === "GET") {
    const slug = slugMatch[1];
    const db = env.DB as D1Database;
    const result = await db.prepare(
      `SELECT * FROM products WHERE slug = ?`
    ).bind(slug).first();

    if (!result) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // PUT /api/admin/products/:slug — update product
  if (slugMatch && method === "PUT") {
    const slug = slugMatch[1];
    const db = env.DB as D1Database;

    // Verify product exists
    const existing = await db.prepare(
      `SELECT id FROM products WHERE slug = ?`
    ).bind(slug).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body: any = await request.json();

      // Build update query dynamically from allowed fields
      const allowed = [
        "title_en", "title_th", "description_en", "description_th",
        "tags", "youtube_url", "images", "image_url", "fabric_options", "category",
        "product_type", "niches"
      ];

      const sets: string[] = [];
      const values: any[] = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          sets.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      // If category is being updated, also sync product_type + niches
      if (body.category !== undefined && body.product_type === undefined && body.niches === undefined) {
        const parsed = parseCategoryCsv(body.category);
        sets.push("product_type = ?");
        values.push(parsed.product_type);
        sets.push("niches = ?");
        values.push(parsed.niches);
      }

      if (sets.length === 0) {
        return new Response(JSON.stringify({ error: "No valid fields to update" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      sets.push("updated_at = datetime('now')");
      values.push(slug);

      await db.prepare(
        `UPDATE products SET ${sets.join(", ")} WHERE slug = ?`
      ).bind(...values).run();

      return new Response(JSON.stringify({
        success: true,
        slug,
        message: "Product updated"
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}
