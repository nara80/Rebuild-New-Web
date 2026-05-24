// MildMate Admin API — Product editing
// GET  /api/admin/products          — list all products
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

const ADMIN_SECRET_ERROR = JSON.stringify({ error: "Unauthorized" });

function authCheck(request: Request, env: any): boolean {
  const auth = request.headers.get("X-Admin-Secret");
  return auth && env.ADMIN_SECRET && auth === env.ADMIN_SECRET;
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
              category, subcategory, fabric_options, base_price_usd, base_price_thb,
              is_custom, image_url, tags, youtube_url, images, sort_order, is_active
       FROM products ORDER BY sort_order, id`
    ).all();

    return new Response(JSON.stringify(result.results || []), {
      headers: { "Content-Type": "application/json" },
    });
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
        "tags", "youtube_url", "images", "image_url"
      ];

      const sets: string[] = [];
      const values: any[] = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          sets.push(`${field} = ?`);
          values.push(body[field]);
        }
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
