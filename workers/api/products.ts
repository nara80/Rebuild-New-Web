// MildMate Products API
// Serves product catalog + category filtering from Cloudflare D1

export interface Product {
  id: number;
  slug: string;
  title_en: string;
  title_th: string | null;
  category: string;
  product_type: string | null;
  niches: string | null;
  fabric_options: string | null;  // e.g. 'BreezePlus,CloudSoft'
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
  tags: string | null;  // comma-separated cross-sell tags, e.g. 'Family, Duvet, Marine, Pets'
}

// Product type slug → display name mapping for reviews table matching
const PRODUCT_TYPE_DISPLAY: Record<string, string> = {
  "sheets": "Sheets",
  "duvet-covers": "Duvet Covers",
  "pillowcases": "Pillowcases",
  "protection": "Protections",
  "accessories": "Accessories",
};

// Niche slug → display name mapping for reviews table matching
const NICHE_DISPLAY: Record<string, string> = {
  "marine": "Marine & Yacht",
  "family": "Family & Co-Sleep",
  "pets": "Pet Owner",
  "deep-pocket": "Deep Pocket",
  "boarding-dorm": "Boarding Dorm",
  "rv-truck": "RV & Truck Cab",
};

export async function listProducts(env: any, filters: { category?: string; product_type?: string; niche?: string; fabric?: string; search?: string }): Promise<Product[]> {
  const db = env.DB as D1Database;
  let sql = `SELECT * FROM products WHERE 1=1`;
  const params: any[] = [];

  if (filters.product_type) {
    sql += ` AND product_type = ?`;
    params.push(filters.product_type);
  } else if (filters.category) {
    // Backward compat: filter by category CSV (exact or prefix match)
    sql += ` AND (product_type = ? OR category = ?)`;
    params.push(filters.category, filters.category);
  }
  if (filters.niche) {
    sql += ` AND (',' || niches || ',' LIKE '%,' || ? || ',%' OR ',' || category || ',' LIKE '%,' || ? || ',%')`;
    params.push(filters.niche, filters.niche);
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
    const product_type = url.searchParams.get("product_type") || undefined;
    const niche = url.searchParams.get("niche") || undefined;
    const fabric = url.searchParams.get("fabric") || undefined;
    const search = url.searchParams.get("search") || undefined;

    try {
      const products = await listProducts(env, { category, product_type, niche, fabric, search });
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

  // GET /api/products/:slug/reviews — 4-tier sorted reviews for a product page
  const reviewsMatch = path.match(/^\/api\/products\/([^\/]+)\/reviews$/);
  if (reviewsMatch) {
    const slug = reviewsMatch[1];
    return handleProductReviews(env, slug);
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

/**
 * Fetches up to 5 reviews for a product page using 4-tier sorting:
 *   Tier 0 — niche match with photo (image_url != '')
 *   Tier 1 — product_type match with photo
 *   Tier 2 — marketplace platforms: Etsy, eBay, Amazon
 *   Tier 3 — all other platforms
 * Within each tier: newest review_date first, then newest created_at.
 */
async function handleProductReviews(env: any, slug: string): Promise<Response> {
  try {
    // 1. Look up product to get product_type + niches
    const product = await getProductBySlug(env, slug);
    if (!product || !product.product_type) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Build display names for SQL matching
    const ptDisplay = PRODUCT_TYPE_DISPLAY[product.product_type] || product.product_type;
    const nicheDisplayNames: string[] = [];
    if (product.niches) {
      product.niches.split(',').forEach(n => {
        const trimmed = n.trim();
        if (trimmed && NICHE_DISPLAY[trimmed]) {
          nicheDisplayNames.push(NICHE_DISPLAY[trimmed]);
        }
      });
    }

    // 3. Match reviews by product_type display name OR any niche display name
    const matchTypes = [ptDisplay, ...nicheDisplayNames];
    const placeholders = matchTypes.map(() => '?').join(',');

    const db = env.DB as D1Database;
    const sql = `
      SELECT id, customer_name, customer_country, review_text, rating,
             product_type, platform, image_url, is_verified, review_date, created_at
      FROM reviews
      WHERE product_type IN (${placeholders})
      ORDER BY
        CASE
          WHEN image_url != '' AND product_type IN (${nicheDisplayNames.map(() => '?').join(',')}) THEN 0
          WHEN image_url != '' AND product_type = ? THEN 1
          WHEN LOWER(platform) IN ('etsy', 'ebay', 'amazon') THEN 2
          ELSE 3
        END,
        review_date DESC,
        created_at DESC
      LIMIT 5
    `;

    const bindings: any[] = [...matchTypes, ...nicheDisplayNames, ptDisplay];
    const result = await db.prepare(sql).bind(...bindings).all();
    const reviews = (result.results || []).map((rv: any) => ({
      ...rv,
      review_date: String(rv.review_date || rv.created_at || '').slice(0, 10),
    }));

    return new Response(JSON.stringify({ reviews, product_type: ptDisplay, niches: nicheDisplayNames }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
