// MildMate Customers API — order history, saved addresses, cart sync
// Auth via Clerk JWT (Authorization: Bearer <token>)
// GET    /api/customers/orders     — user's orders
// GET    /api/customers/cart       — saved cart from D1
// PUT    /api/customers/cart       — save cart to D1
// DELETE /api/customers/cart       — clear saved cart
// GET    /api/customers/addresses        — list saved addresses
// POST   /api/customers/addresses        — add address
// PUT    /api/customers/addresses?id=N   — update address
// DELETE /api/customers/addresses?id=N   — delete address
//
// Security: Clerk JWT verified with Web Crypto + JWKS (clerk-verify.ts)

import { verifyClerkJwt } from "./clerk-verify";

let orderShippingSchemaReady = false;
let orderShippingSchemaPromise: Promise<void> | null = null;

async function ensureOrderShippingSchema(env: any): Promise<void> {
  if (orderShippingSchemaReady) return;
  if (!orderShippingSchemaPromise) {
    orderShippingSchemaPromise = (async () => {
      const tableInfo = await env.DB.prepare("PRAGMA table_info(orders)").all();
      const existing = new Set(
        (tableInfo.results || []).map((r: any) => String(r.name || "").toLowerCase())
      );
      const alters: string[] = [];
      if (!existing.has("carrier_code")) alters.push("ALTER TABLE orders ADD COLUMN carrier_code TEXT");
      if (!existing.has("tracking_number")) alters.push("ALTER TABLE orders ADD COLUMN tracking_number TEXT");
      if (!existing.has("tracking_url")) alters.push("ALTER TABLE orders ADD COLUMN tracking_url TEXT");
      if (!existing.has("shipping_status")) alters.push("ALTER TABLE orders ADD COLUMN shipping_status TEXT");
      if (!existing.has("shipped_at")) alters.push("ALTER TABLE orders ADD COLUMN shipped_at DATETIME");
      for (const sql of alters) await env.DB.prepare(sql).run();
      orderShippingSchemaReady = true;
    })().finally(() => {
      if (!orderShippingSchemaReady) orderShippingSchemaPromise = null;
    });
  }
  await orderShippingSchemaPromise;
}

/** Extract and verify Clerk JWT — returns email or sends error response.
 *  Falls back to X-User-Email header when JWT doesn't include email claim. */
async function getEmail(request: Request, env: any): Promise<string | Response> {
  const result = await verifyClerkJwt(request, env);
  if (!result.valid) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Clerk session JWT may not include email — fall back to header
  const email = result.payload.email || request.headers.get("X-User-Email") || "";
  if (!email) {
    return new Response(JSON.stringify({ error: "No email in token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return email;
}

export async function handleCustomers(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /api/customers/orders
  if (request.method === "GET" && (path === "/api/customers/orders" || path === "/api/customers/orders/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    // Check for guest-order email bridge (from localStorage via X-Order-Email header)
    const guestEmail = (request.headers.get("X-Order-Email") || "").trim().toLowerCase();
    const hasGuestBridge = guestEmail && guestEmail !== email.toLowerCase();

    try {
      await ensureOrderShippingSchema(env);
      const query = `SELECT o.id, o.stripe_session_id, o.product_title_en, o.product_slug,
                o.fabric, o.color,
                o.width_cm, o.length_cm, o.depth_cm, o.width_in, o.length_in, o.depth_in,
                o.price_usd, o.price_thb, o.currency, o.quantity, o.status,
                o.created_at, o.shipping_address,
                o.carrier_code, o.tracking_number, o.tracking_url,
                o.shipping_status, o.shipped_at,
                COALESCE(
                  (
                    SELECT p1.image_url
                    FROM products p1
                    WHERE LOWER(TRIM(p1.slug, '/')) = LOWER(
                      CASE
                        WHEN LOWER(TRIM(COALESCE(o.product_slug, ''), '/')) LIKE 'product/%'
                          THEN SUBSTR(LOWER(TRIM(COALESCE(o.product_slug, ''), '/')), 9)
                        ELSE LOWER(TRIM(COALESCE(o.product_slug, ''), '/'))
                      END
                    )
                    LIMIT 1
                  ),
                  (
                    SELECT p2.image_url
                    FROM products p2
                    WHERE LOWER(TRIM(COALESCE(p2.title_en, ''))) = LOWER(TRIM(COALESCE(o.product_title_en, '')))
                    LIMIT 1
                  )
                ) AS image_url
         FROM orders o
         WHERE LOWER(o.email) IN (LOWER(?1)${hasGuestBridge ? ", LOWER(?2)" : ""})
         ORDER BY o.created_at DESC
         LIMIT 50`;

      let stmt;
      if (hasGuestBridge) {
        stmt = env.DB.prepare(query).bind(email, guestEmail);
      } else {
        stmt = env.DB.prepare(query).bind(email);
      }
      const raw = await stmt.all();
      let results = (raw.results || []) as any[];

      // Deduplicate by stripe_session_id (same order could match both emails)
      if (hasGuestBridge && results.length > 0) {
        const seen = new Set<string>();
        results = results.filter((r: any) => {
          const sid = r.stripe_session_id || "";
          if (seen.has(sid)) return false;
          seen.add(sid);
          return true;
        });
      }

      return new Response(JSON.stringify({
        orders: results.map((r: any) => ({ ...r, image_url: r.image_url && (r.image_url as string).startsWith("/r2/") ? `https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev${(r.image_url as string).slice(3)}` : r.image_url })),
        merged: hasGuestBridge,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Failed to fetch orders:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // GET /api/customers/cart — get saved cart from D1
  if (request.method === "GET" && (path === "/api/customers/cart" || path === "/api/customers/cart/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    try {
      const row = await env.DB.prepare(
        "SELECT cart_json FROM abandoned_carts WHERE email = ?1 AND recovered = 0 ORDER BY created_at DESC LIMIT 1"
      ).bind(email).first();

      return new Response(JSON.stringify({
        items: row ? JSON.parse(row.cart_json) : [],
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // PUT /api/customers/cart — save cart to D1 (upsert: replace existing non-recovered)
  if (request.method === "PUT" && (path === "/api/customers/cart" || path === "/api/customers/cart/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    try {
      const body: any = await request.json();
      const items = body.items || [];

      if (!Array.isArray(items)) {
        return new Response(JSON.stringify({ error: "items must be an array" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Replace existing non-recovered cart for this user
      await env.DB.prepare(
        "DELETE FROM abandoned_carts WHERE email = ?1 AND recovered = 0"
      ).bind(email).run();

      if (items.length > 0) {
        await env.DB.prepare(
          "INSERT INTO abandoned_carts (email, cart_json, created_at) VALUES (?1, ?2, datetime('now'))"
        ).bind(email, JSON.stringify(items)).run();
      }

      return new Response(JSON.stringify({ success: true, itemCount: items.length }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Failed to save cart:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // DELETE /api/customers/cart — clear saved cart from D1
  if (request.method === "DELETE" && (path === "/api/customers/cart" || path === "/api/customers/cart/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    try {
      await env.DB.prepare(
        "DELETE FROM abandoned_carts WHERE email = ?1 AND recovered = 0"
      ).bind(email).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Failed to clear cart:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ═══ Addresses ═══

  // GET /api/customers/addresses — list saved addresses
  if (request.method === "GET" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    try {
      const { results } = await env.DB.prepare(
        "SELECT id, label, first_name, last_name, phone, country, address, city, state, postal_code, is_default FROM customer_addresses WHERE email = ?1 ORDER BY is_default DESC, created_at ASC"
      ).bind(email).all();

      return new Response(JSON.stringify({ addresses: results }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Failed to fetch addresses:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // POST /api/customers/addresses — add address
  if (request.method === "POST" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    try {
      const body: any = await request.json();
      const { label, first_name, last_name, phone, country, address, city, state, postal_code } = body;

      if (!first_name || !last_name || !phone || !country || !address || !city) {
        return new Response(JSON.stringify({ error: "Missing required fields: first_name, last_name, phone, country, address, city" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Count existing addresses — limit to 5
      const countRow = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM customer_addresses WHERE email = ?1"
      ).bind(email).first();
      if (countRow && countRow.cnt >= 5) {
        return new Response(JSON.stringify({ error: "Maximum 5 addresses allowed" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // If this is the first address or is_default requested, unset existing defaults
      const setDefault = body.is_default || (countRow && countRow.cnt === 0);
      if (setDefault) {
        await env.DB.prepare(
          "UPDATE customer_addresses SET is_default = 0 WHERE email = ?1"
        ).bind(email).run();
      }

      const result = await env.DB.prepare(
        `INSERT INTO customer_addresses (email, label, first_name, last_name, phone, country, address, city, state, postal_code, is_default)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
      ).bind(
        email,
        label || "Home",
        first_name,
        last_name,
        phone,
        country,
        address,
        city,
        state || "",
        postal_code || "",
        setDefault ? 1 : 0
      ).run();

      return new Response(JSON.stringify({
        success: true,
        id: result.meta?.last_row_id,
      }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Failed to add address:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // PUT /api/customers/addresses?id=N — update address
  if (request.method === "PUT" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    const addrId = url.searchParams.get("id");
    if (!addrId) {
      return new Response(JSON.stringify({ error: "Missing ?id= parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body: any = await request.json();

      // Verify ownership
      const existing = await env.DB.prepare(
        "SELECT * FROM customer_addresses WHERE id = ?1 AND email = ?2"
      ).bind(addrId, email).first();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Address not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Merge: use body values when provided, keep existing otherwise
      const label = body.label !== undefined ? body.label : existing.label;
      const first_name = body.first_name !== undefined ? body.first_name : existing.first_name;
      const last_name = body.last_name !== undefined ? body.last_name : existing.last_name;
      const phone = body.phone !== undefined ? body.phone : existing.phone;
      const country = body.country !== undefined ? body.country : existing.country;
      const address = body.address !== undefined ? body.address : existing.address;
      const city = body.city !== undefined ? body.city : existing.city;
      const state = body.state !== undefined ? body.state : existing.state;
      const postal_code = body.postal_code !== undefined ? body.postal_code : existing.postal_code;
      const is_default = body.is_default !== undefined ? body.is_default : existing.is_default;

      // If setting as default, unset all other defaults
      if (is_default) {
        await env.DB.prepare(
          "UPDATE customer_addresses SET is_default = 0 WHERE email = ?1"
        ).bind(email).run();
      }

      await env.DB.prepare(
        `UPDATE customer_addresses
         SET label = ?1, first_name = ?2, last_name = ?3, phone = ?4, country = ?5,
             address = ?6, city = ?7, state = ?8, postal_code = ?9, is_default = ?10,
             updated_at = datetime('now')
         WHERE id = ?11 AND email = ?12`
      ).bind(
        label,
        first_name,
        last_name,
        phone,
        country,
        address,
        city,
        state,
        postal_code,
        is_default ? 1 : 0,
        addrId,
        email
      ).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Failed to update address:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // DELETE /api/customers/addresses?id=N — delete address
  if (request.method === "DELETE" && (path === "/api/customers/addresses" || path === "/api/customers/addresses/")) {
    const emailOrErr = await getEmail(request, env);
    if (typeof emailOrErr !== "string") return emailOrErr;
    const email = emailOrErr;

    const addrId = url.searchParams.get("id");
    if (!addrId) {
      return new Response(JSON.stringify({ error: "Missing ?id= parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const existing = await env.DB.prepare(
        "SELECT id, is_default FROM customer_addresses WHERE id = ?1 AND email = ?2"
      ).bind(addrId, email).first();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Address not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      await env.DB.prepare(
        "DELETE FROM customer_addresses WHERE id = ?1 AND email = ?2"
      ).bind(addrId, email).run();

      // If deleted was default, make the next oldest address default
      if (existing.is_default) {
        const next = await env.DB.prepare(
          "SELECT id FROM customer_addresses WHERE email = ?1 ORDER BY created_at ASC LIMIT 1"
        ).bind(email).first();
        if (next) {
          await env.DB.prepare(
            "UPDATE customer_addresses SET is_default = 1 WHERE id = ?1"
          ).bind(next.id).run();
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      console.error("Failed to delete address:", e.message);
      return new Response(JSON.stringify({ error: "Database error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
