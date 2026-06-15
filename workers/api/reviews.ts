// workers/api/reviews.ts
// Public GET /api/reviews and Admin CRUD /api/admin/reviews

import { verifyClerkJwt } from "./clerk-verify";

const R2_PUBLIC_BASE = "https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev";

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

function normalizeMojibake(str: string | null | undefined): string {
  const s = sanitize(str);
  if (!s) return '';
  return s
    .replace(/ΓÇÖ/g, "’")
    .replace(/ΓÇ£/g, "“")
    .replace(/ΓÇ¥/g, "”")
    .replace(/ΓÇö/g, "—")
    .replace(/ΓÇô/g, "–")
    .replace(/ΓÇª/g, "…")
    .replace(/ΓÇ¢/g, "•")
    .replace(/├ù/g, "×")
    .replace(/≡ƒñì/g, "")
    .replace(/�/g, "");
}

function toR2Url(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/r2/')) return `${R2_PUBLIC_BASE}${url.slice(3)}`;
  return url;
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

function normalizeReviewDate(raw: any): string {
  const val = sanitize(typeof raw === 'string' ? raw : String(raw || ''));
  if (!val) return new Date().toISOString().slice(0, 10);
  const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const dt = new Date(val);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function isProductionHost(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".pages.dev")) return false;
  if (host.endsWith(".local")) return false;
  return host === "www.mildmate.com" || host === "mildmate.com";
}

function collectRoles(raw: any): string[] {
  if (!raw || typeof raw !== "object") return [];
  const values: any[] = [];
  const add = (v: any) => { if (v !== undefined && v !== null) values.push(v); };
  add(raw.role);
  add(raw.roles);
  add(raw.org_role);
  add(raw.orgRole);
  add(raw.public_metadata?.role);
  add(raw.public_metadata?.roles);
  add(raw.unsafe_metadata?.roles);
  add(raw.metadata?.role);
  add(raw.metadata?.roles);
  add(raw["https://mildmate.com/role"]);
  add(raw["https://mildmate.com/roles"]);
  const out: string[] = [];
  values.forEach((v) => {
    if (Array.isArray(v)) v.forEach((x) => out.push(String(x).toLowerCase().trim()));
    else out.push(String(v).toLowerCase().trim());
  });
  return out.filter(Boolean);
}

function hasAdminRole(raw: any): boolean {
  const roles = collectRoles(raw);
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

function getClerkSessionTokenFromCookie(request: Request): string {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match =
    cookieHeader.match(/__session=([^;]+)/) ||
    cookieHeader.match(/__clerk_db_jwt=([^;]+)/);
  return match ? String(match[1] || "").trim() : "";
}

async function authorizeAdmin(request: Request, env: any): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = request.headers.get("Authorization") || "";
  const cookieToken = getClerkSessionTokenFromCookie(request);
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const token = bearerToken || cookieToken;

  if (token) {
    const verifyRequest = bearerToken
      ? request
      : new Request(request.url, {
          method: request.method,
          headers: new Headers({
            ...Object.fromEntries(request.headers.entries()),
            Authorization: "Bearer " + token
          })
        });
    const verified = await verifyClerkJwt(verifyRequest, env);
    if (verified.valid) {
      const raw = verified.payload.raw || {};
      if (hasAdminRole(raw) || emailAllowed(verified.payload.email || "", env)) {
        return { ok: true };
      }
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
            if (emailAllowed(email, env)) return { ok: true };
            if (hasAdminRole(metadata)) return { ok: true };
          }
        } catch (e: any) {
          console.error("Clerk API lookup failed:", e?.message || e);
        }
      }
      return { ok: false, status: 403, error: "Forbidden: admin role required" };
    }
  }

  const provided = (request.headers.get("X-Admin-Secret") || "").trim();
  const configured = typeof env.ADMIN_SECRET === "string" ? env.ADMIN_SECRET.trim() : "";
  if (!provided) return { ok: false, status: 401, error: "Unauthorized" };

  const host = new URL(request.url).hostname;
  const prodHost = isProductionHost(host);
  const allowSecretInProd = String(env.ADMIN_SECRET_ALLOW_PROD || "").toLowerCase() === "true";
  if (prodHost && !allowSecretInProd) {
    return { ok: false, status: 401, error: "Unauthorized: use Clerk admin session" };
  }

  if (!configured) return { ok: true };
  if (provided === configured) return { ok: true };
  return { ok: false, status: 401, error: "Unauthorized" };
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
    const sort = url.searchParams.get('sort') || '';

    let sql = `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,review_date,created_at FROM reviews WHERE 1=1`;
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

    if (sort === 'priority') {
      sql += ` ORDER BY CASE WHEN LOWER(platform) IN ('etsy','ebay','amazon') THEN 0 ELSE 1 END, review_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`;
    } else {
      sql += ` ORDER BY review_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`;
    }
    bindings.push(limit, offset);

    let results: any[] = [];
    try {
      const stmt = env.DB.prepare(sql).bind(...bindings);
      const out = await stmt.all();
      results = out.results || [];
    } catch (e: any) {
      if (!String(e.message || '').includes('review_date')) throw e;
      sql = sql.replace('review_date,', '');
      sql = sql.replace(/, review_date DESC/, '');
      sql = sql.replace('ORDER BY review_date DESC,', 'ORDER BY ');
      const stmt = env.DB.prepare(sql).bind(...bindings);
      const out = await stmt.all();
      results = out.results || [];
    }
    results = (results || []).map((rv: any) => ({
      ...rv,
      review_date: normalizeReviewDate(rv.review_date || rv.created_at)
    }));

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

    const normalized = (results || []).map((rv: any) => ({
      ...rv,
      customer_name: normalizeMojibake(rv.customer_name || ''),
      customer_country: normalizeMojibake(rv.customer_country || ''),
      review_text: normalizeMojibake(rv.review_text || ''),
      image_url: toR2Url(rv.image_url || '')
    }));

    return new Response(JSON.stringify({ reviews: normalized, total, limit, offset }), {
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
  const auth = await authorizeAdmin(request, env);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
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
        const review = post as any;
        review.customer_name = normalizeMojibake(review.customer_name || '');
        review.customer_country = normalizeMojibake(review.customer_country || '');
        review.review_text = normalizeMojibake(review.review_text || '');
        review.review_date = normalizeReviewDate(review.review_date || review.created_at);
        review.image_url = toR2Url(review.image_url || '');
        return new Response(JSON.stringify({ review }), { headers });
      }

      let results: any[] = [];
      try {
        const stmt = env.DB.prepare(
          `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,review_date,created_at,updated_at FROM reviews ORDER BY created_at DESC LIMIT 100`
        );
        const out = await stmt.all();
        results = out.results || [];
      } catch (e: any) {
        if (!String(e.message || '').includes('review_date')) throw e;
        const stmt = env.DB.prepare(
          `SELECT id,customer_name,customer_country,review_text,rating,product_type,platform,image_url,is_verified,created_at,updated_at FROM reviews ORDER BY created_at DESC LIMIT 100`
        );
        const out = await stmt.all();
        results = out.results || [];
      }
      results = results.map((rv: any) => ({
        ...rv,
        customer_name: normalizeMojibake(rv.customer_name || ''),
        customer_country: normalizeMojibake(rv.customer_country || ''),
        review_text: normalizeMojibake(rv.review_text || ''),
        review_date: normalizeReviewDate(rv.review_date || rv.created_at),
        image_url: toR2Url(rv.image_url || '')
      }));
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
      const reviewDate = normalizeReviewDate(body.review_date || body.created_at || '');

      let result: any;
      try {
        const stmt = env.DB.prepare(`
          INSERT INTO reviews (customer_name, customer_country, review_text, rating, product_type, platform, image_url, is_verified, review_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          customerName,
          sanitize(body.customer_country || ''),
          reviewText,
          rating,
          productType,
          platform,
          sanitize(body.image_url || ''),
          body.is_verified ? 1 : 0,
          reviewDate
        );
        result = await stmt.run();
      } catch (e: any) {
        if (!String(e.message || '').includes('review_date')) throw e;
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
        result = await stmt.run();
      }
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
      if (body.review_date !== undefined) {
        updates.push('review_date = ?');
        bindings.push(normalizeReviewDate(body.review_date));
      }
      if (body.is_verified !== undefined) {
        updates.push('is_verified = ?');
        bindings.push(body.is_verified ? 1 : 0);
      }

      if (updates.length === 0) return badRequest('No fields to update');

      updates.push("updated_at = datetime('now')");
      bindings.push(id);

      const updateSql = `UPDATE reviews SET ${updates.join(', ')} WHERE id = ?`;
      const reviewDateIdx = updates.findIndex((u) => u.startsWith('review_date ='));
      try {
        const stmt = env.DB.prepare(updateSql).bind(...bindings);
        await stmt.run();
      } catch (e: any) {
        if (!String(e.message || '').includes('review_date') || reviewDateIdx < 0) throw e;
        const updatesLegacy = updates.slice();
        updatesLegacy.splice(reviewDateIdx, 1);
        const bindingsLegacy = bindings.slice();
        bindingsLegacy.splice(reviewDateIdx, 1);
        const stmt = env.DB.prepare(`UPDATE reviews SET ${updatesLegacy.join(', ')} WHERE id = ?`).bind(...bindingsLegacy);
        await stmt.run();
      }
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
