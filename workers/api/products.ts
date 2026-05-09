// MildMate Products API
// Serves product catalog + category filtering from Cloudflare D1

export interface Product {
  id: number;
  slug: string;
  title_en: string;
  title_th: string | null;
  category: string;
  fabric: string | null;
  price_usd: number | null;
  price_thb: number | null;
  description_en: string | null;
  description_th: string | null;
  image_url: string | null;
  is_custom: boolean;
  base_price_usd: number | null;
  base_price_thb: number | null;
  rate_per_cm2_usd: number | null;
  rate_per_cm2_thb: number | null;
}

export async function listProducts(env: any, filters: { category?: string; fabric?: string; search?: string }): Promise<Product[]> {
  const db = env.DB as D1Database;
  let sql = `SELECT * FROM products WHERE 1=1`;
  const params: any[] = [];

  if (filters.category) {
    sql += ` AND category = ?`;
    params.push(filters.category);
  }
  if (filters.fabric) {
    sql += ` AND fabric = ?`;
    params.push(filters.fabric);
  }
  if (filters.search) {
    sql += ` AND (title_en LIKE ? OR description_en LIKE ?)`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  sql += ` ORDER BY id LIMIT 100`;
  const result = await db.prepare(sql).bind(...params).all();
  return (result.results || []) as Product[];
}

export async function getProductBySlug(env: any, slug: string): Promise<Product | null> {
  const db = env.DB as D1Database;
  const result = await db.prepare(`SELECT * FROM products WHERE slug = ?`).bind(slug).first();
  return result as Product | null;
}

export async function handleProducts(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/products" || path === "/api/products/") {
    const category = url.searchParams.get("category") || undefined;
    const fabric = url.searchParams.get("fabric") || undefined;
    const search = url.searchParams.get("search") || undefined;

    try {
      const products = await listProducts(env, { category, fabric, search });
      return new Response(JSON.stringify({ products }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const slugMatch = path.match(/^\/api\/products\/(.+)$/);
  if (slugMatch) {
    try {
      const product = await getProductBySlug(env, slugMatch[1]);
      if (!product) {
        return new Response(JSON.stringify({ error: "Product not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ product }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
