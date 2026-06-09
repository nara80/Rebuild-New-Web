// workers/api/reviews.ts
// Public GET /api/reviews and Admin CRUD /api/admin/reviews

const ALLOWED_PRODUCT_TYPES = [
  'Sheets', 'Pillowcases', 'Protections', 'Duvet Covers', 'Accessories',
  'Marine & Yacht', 'Family & Co-Sleep', 'Deep Pocket', 'Boarding Dorm', 'Pet Owner', 'RV & Truck Cab'
];

const ALLOWED_PLATFORMS = [
  'etsy', 'ebay', 'amazon', 'shopee', 'lazada', 'tiktok',
  'website', 'lineoa', 'line', 'whatsapp', 'facebook', 'instagram'
];

function sanitize(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim();
}

function sanitizeReviewText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
    .trim();
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}

function authorizeAdminSecret(request: Request, env: any): boolean {
  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  const hostname = request.headers.get("Host") || "";
  const prodHost = isProductionHost(hostname);
  if (!provided) return false;
  if (!configured) return !prodHost;
  return provided === configured;
}

// ── Public GET /api/reviews ────────────────────────────────────────────────
export async function handleReviews(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);

  // Admin route — reject public access
  if (url.pathname.startsWith('/api/admin/reviews')) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const productType = url.searchParams.get('product_type') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const rating = url.searchParams.get('min_rating');

    let sql = `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,created_at FROM reviews WHERE 1=1`;
    const bindings: any[] = [];

    if (productType && ALLOWED_PRODUCT_TYPES.includes(productType)) {
      sql += ` AND product_type = ?`;
      bindings.push(productType);
    }
    if (rating) {
      const r = parseInt(rating, 10);
      if (r >= 1 && r <= 5) {
        sql += ` AND rating >= ?`;
        bindings.push(r);
      }
    }

    sql += ` ORDER BY is_verified DESC, rating DESC, created_at DESC LIMIT ? OFFSET ?`;
    bindings.push(limit, offset);

    const stmt = env.DB.prepare(sql).bind(...bindings);
    const { results } = await stmt.all();

    // Count total
    let countSql = `SELECT COUNT(*) as total FROM reviews WHERE 1=1`;
    const countBindings: any[] = [];
    if (productType && ALLOWED_PRODUCT_TYPES.includes(productType)) {
      countSql += ` AND product_type = ?`;
      countBindings.push(productType);
    }
    if (rating) {
      const r = parseInt(rating, 10);
      if (r >= 1 && r <= 5) {
        countSql += ` AND rating >= ?`;
        countBindings.push(r);
      }
    }
    const countStmt = env.DB.prepare(countSql).bind(...countBindings);
    const countRow = await countStmt.first();
    const total = countRow ? (countRow as any).total : 0;

    return new Response(JSON.stringify({ reviews: results || [], total, limit, offset }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    });
  } catch (e: any) {
    console.error('Reviews GET error:', e);
    return new Response(JSON.stringify({ error: 'Server error', details: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ── Admin CRUD /api/admin/reviews ──────────────────────────────────────────
export async function handleAdminReviews(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const headers = { 'Content-Type': 'application/json' };

  // Verify admin auth
  if (!authorizeAdminSecret(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers
    });
  }

  // Normalize legacy platform key
  function normalizePlatform(raw: string): string {
    const v = sanitize(raw).toLowerCase();
    if (v === 'lineoa') return 'line';
    return v;
  }

  function badRequest(msg: string): Response {
    return new Response(JSON.stringify({ error: msg }), { status: 400, headers });
  }

  function internalError(msg: string): Response {
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }

  const method = request.method;

  try {
    // GET — list all reviews
    if (method === 'GET') {
      const id = url.searchParams.get('id');
      if (id) {
        const stmt = env.DB.prepare(
          `SELECT * FROM reviews WHERE id = ?`
        ).bind(parseInt(id, 10));
        const post = await stmt.first();
        if (!post) {
          return new Response(JSON.stringify({ error: 'Review not found' }), {
            status: 404,
            headers
          });
        }
        return new Response(JSON.stringify({ review: post }), { headers });
      }

      const stmt = env.DB.prepare(
        `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,created_at,updated_at FROM reviews ORDER BY created_at DESC LIMIT 100`
      );
      const { results } = await stmt.all();
      return new Response(JSON.stringify({ reviews: results || [] }), { headers });
    }

    // POST — create new review
    if (method === 'POST') {
      const body = await request.json() as any;

      const customerName = sanitize(body.customer_name);
      if (!customerName) return badRequest('Customer name is required');

      const reviewText = sanitizeReviewText(body.review_text || '');
      if (!reviewText) return badRequest('Review text is required');

      const productTypeRaw = sanitize(body.product_type || '');
      const productType = ALLOWED_PRODUCT_TYPES.includes(productTypeRaw) ? productTypeRaw : 'Marine & Yacht';

      const platform = normalizePlatform(body.platform || '');
      if (!ALLOWED_PLATFORMS.includes(platform)) return badRequest('Invalid platform');

      const rating = Math.min(5, Math.max(1, parseInt(body.rating || '5', 10)));

      const stmt = env.DB.prepare(`
        INSERT INTO reviews (customer_name, customer_country, review_text, rating, product_type, platform, image_url, is_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        customerName,
        sanitize(body.customer_country || ''),
        reviewText,
        rating,
        productType,
        platform,
        sanitize(body.image_url || ''),
        body.is_verified ? 1 : 0
      );

      const result = await stmt.run();
      return new Response(JSON.stringify({ success: true, id: result.meta?.last_row_id }), {
        status: 201,
        headers
      });
    }

    // PUT — update review
    if (method === 'PUT') {
      const body = await request.json() as any;

      if (!body.id) return badRequest('Review ID required');
      const id = parseInt(body.id, 10);

      const updates: string[] = [];
      const bindings: any[] = [];

      if (body.customer_name !== undefined) {
        updates.push('customer_name = ?');
        bindings.push(sanitize(body.customer_name));
      }
      if (body.customer_country !== undefined) {
        updates.push('customer_country = ?');
        bindings.push(sanitize(body.customer_country));
      }
      if (body.review_text !== undefined) {
        updates.push('review_text = ?');
        bindings.push(sanitizeReviewText(body.review_text));
      }
      if (body.rating !== undefined) {
        updates.push('rating = ?');
        bindings.push(Math.min(5, Math.max(1, parseInt(body.rating, 10))));
      }
      if (body.product_type !== undefined) {
        const productType = sanitize(body.product_type);
        if (!ALLOWED_PRODUCT_TYPES.includes(productType)) return badRequest('Invalid product_type');
        updates.push('product_type = ?');
        bindings.push(productType);
      }
      if (body.platform !== undefined) {
        const platform = normalizePlatform(body.platform);
        if (!ALLOWED_PLATFORMS.includes(platform)) return badRequest('Invalid platform');
        updates.push('platform = ?');
        bindings.push(platform);
      }
      if (body.image_url !== undefined) {
        updates.push('image_url = ?');
        bindings.push(sanitize(body.image_url));
      }
      if (body.is_verified !== undefined) {
        updates.push('is_verified = ?');
        bindings.push(body.is_verified ? 1 : 0);
      }

      if (updates.length === 0) return badRequest('No fields to update');

      updates.push("updated_at = datetime('now')");
      bindings.push(id);

      const stmt = env.DB.prepare(
        `UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...bindings);

      await stmt.run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // DELETE — remove review
    if (method === 'DELETE') {
      const body = await request.json() as any;
      if (!body.id) return badRequest('Review ID required');

      const stmt = env.DB.prepare(`DELETE FROM reviews WHERE id = ?`).bind(parseInt(body.id, 10));
      await stmt.run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  } catch (e: any) {
    console.error('Admin reviews error:', e);
    return internalError('Server error: ' + e.message);
  }
}
