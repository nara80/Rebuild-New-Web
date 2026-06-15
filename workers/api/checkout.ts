// MildMate Checkout API — Stripe Checkout Session creator
// POST /api/checkout  { items: [...], email, name, phone, address }
// Returns { url } — frontend redirects to Stripe hosted checkout
// Requires STRIPE_SECRET_KEY set as Cloudflare secret

import { calculateShippingQuote } from "./shipping";

interface CartItem {
  type: string;           // 'product' | 'custom_quote'
  id?: string;
  product_slug: string;
  product_name: string;
  dimensions: { w: number; l: number; d?: number; unit: string };
  fabric: string;
  color: string;
  price_usd: number;
  price_thb: number;
  qty: number;
  image?: string;
  quote_id?: string;      // only for custom_quote type
}

export async function handleCheckout(request: Request, env: any): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Payment not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { items, email, name, phone, address, currency: bodyCurrency, cart_total_thb, cart_total_usd } = body;
  const shippingCountryInput = body.shipping_country || body.country_code || "";
  const shippingServiceLevel = body.shipping_service_level || "express";
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const discountCode = (body.discount_code || "").trim().toUpperCase();
  let discountApplied = false;
  let discountPct = 0;
  let discountType = null; // 'promo' | 'welcome'
  if (discountCode) {
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required before applying discount code" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    // Check promo_codes FIRST (admin-created, mutual exclusivity)
    const promo = await env.DB.prepare(
      "SELECT id, discount_pct, order_minimum_usd, order_minimum_thb, max_uses, use_count, per_email_limit, is_active, expires_at FROM promo_codes WHERE code = ? AND is_active = 1"
    ).bind(discountCode).first() as any;
    if (promo) {
      if (promo.expires_at && promo.expires_at < new Date().toISOString()) {
        return new Response(JSON.stringify({ error: "This promo code has expired" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      if (promo.max_uses !== null && promo.use_count >= promo.max_uses) {
        return new Response(JSON.stringify({ error: "This promo code has reached its usage limit" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      const minUsd = promo.order_minimum_usd ?? promo.order_minimum_thb ?? 0;
      if (minUsd > 0 && (cart_total_usd || 0) < minUsd) {
        return new Response(JSON.stringify({
          error: `Minimum order of $${minUsd} USD required for this code (your cart: $${Math.round(cart_total_usd || 0)} USD)`,
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if (promo.per_email_limit > 0) {
        const redeemed = await env.DB.prepare(
          "SELECT id FROM promo_redemptions WHERE promo_id = ? AND email = ?"
        ).bind(promo.id, normalizedEmail).first();
        if (redeemed) {
          return new Response(JSON.stringify({ error: "You have already used this promo code" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }
      }
      discountApplied = true;
      discountPct = promo.discount_pct;
      discountType = "promo";
    } else {
      // Fall back to welcome/discount_claims (mutually exclusive with promo)
      const claim = await env.DB.prepare(
        "SELECT id, email, status, expires_at FROM discount_claims WHERE code = ? AND status = 'issued'"
      ).bind(discountCode).first();
      if (!claim) {
        return new Response(JSON.stringify({ error: "Invalid or already used discount code" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      if (claim.expires_at && claim.expires_at < new Date().toISOString()) {
        await env.DB.prepare("UPDATE discount_claims SET status = 'expired' WHERE id = ?").bind(claim.id).run();
        return new Response(JSON.stringify({ error: "Discount code has expired" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      if (String(claim.email || "").toLowerCase() !== normalizedEmail) {
        return new Response(JSON.stringify({ error: "This welcome code is linked to a different email account." }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
      discountApplied = true;
      discountPct = 15; // welcome codes are always 15%
      discountType = "welcome";
    }
  }


  if (!items || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: "Cart is empty" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!normalizedEmail || typeof normalizedEmail !== "string" || !normalizedEmail.includes("@")) {
    return new Response(JSON.stringify({ error: "Valid email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check for custom-quote items that haven't been approved
  const quoteItems = items.filter((i: CartItem) => i.type === "custom_quote" && i.quote_id);
  if (quoteItems.length > 0) {
    for (const qi of quoteItems) {
      const quote = await env.DB.prepare(
        "SELECT status, quoted_price FROM custom_quotes WHERE quote_id = ?1"
      ).bind(qi.quote_id).first();
      if (!quote || quote.status !== "approved") {
        return new Response(JSON.stringify({
          error: `Quote ${qi.quote_id} is not yet approved. Remove it from cart to continue.`
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  // Detect currency: prefer frontend preference, fallback to IP country
  const origin = String(request.headers.get("CF-IPCountry") || "").toUpperCase();
  const shippingCountry = String(shippingCountryInput || "").toUpperCase();
  const thCountries = ["TH", "LA", "MM", "KH"];
  let currency = "usd";
  if (shippingCountry === "TH") {
    // PromptPay requires THB — force THB for Thailand shipping.
    currency = "thb";
  } else if (bodyCurrency === "THB" || bodyCurrency === "thb") {
    currency = "thb";
  } else if (bodyCurrency === "USD" || bodyCurrency === "usd") {
    currency = "usd";
  } else if (thCountries.includes(origin)) {
    currency = "thb";
  }

  const totalQty = items.reduce((sum: number, item: CartItem) => sum + Math.max(0, Number(item.qty || 0)), 0);
  let shippingQuote: any;
  try {
    shippingQuote = await calculateShippingQuote(env, {
      countryCode: shippingCountryInput,
      fallbackCountryCode: origin || "",
      currency: currency.toUpperCase(),
      serviceLevel: shippingServiceLevel,
      totalQty,
    });
  } catch (e: any) {
    console.error("Shipping quote error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Shipping configuration unavailable. Please try again." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build Stripe line items
  const lineItems = items.map((item: CartItem) => {
    const unitAmount = currency === "thb"
      ? Math.round((item.price_thb || 0) * 100)
      : Math.round((item.price_usd || 0) * 100);

    const desc = [
      item.product_name,
      item.fabric ? `Fabric: ${item.fabric}` : "",
      item.color ? `Color: ${item.color}` : "",
      item.dimensions
        ? `${item.dimensions.w}\u00D7${item.dimensions.l}${item.dimensions.d ? `\u00D7${item.dimensions.d}` : ""} ${item.dimensions.unit}`
        : "",
    ].filter(Boolean).join(" | ");

    return {
      price_data: {
        currency: currency,
        product_data: {
          name: item.product_name,
          description: desc,
        },
        unit_amount: discountApplied ? Math.round(unitAmount * (100 - discountPct) / 100) : unitAmount,
      },
      quantity: item.qty || 1,
    };
  });

  const shippingMinor = Math.round(Number(shippingQuote?.amount || 0) * 100);
  if (shippingMinor > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: {
          name: `Shipping (${shippingQuote.country_name || shippingQuote.applied_country || "Other"})`,
          description: `${String(shippingQuote?.service_level || "express").toUpperCase()} • First item ${shippingQuote.first_item} + each additional ${shippingQuote.additional_item}`,
        },
        unit_amount: shippingMinor,
      },
      quantity: 1,
    });
  }

  // Save abandoned cart (Phase 6 recovery)
  try {
    const existing = await env.DB.prepare(
      "SELECT id FROM abandoned_carts WHERE email = ?1 AND recovered = 0"
    ).bind(normalizedEmail).first();

    if (existing) {
      await env.DB.prepare(
        "UPDATE abandoned_carts SET cart_json = ?1, customer_name = ?2, created_at = datetime('now') WHERE id = ?3"
      ).bind(JSON.stringify(items), name || null, existing.id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO abandoned_carts (email, customer_name, cart_json) VALUES (?1, ?2, ?3)"
      ).bind(normalizedEmail, name || null, JSON.stringify(items)).run();
    }
  } catch {
    // Non-critical
  }

  // Create Stripe Checkout Session
  const siteUrl = request.url.includes("localhost") || request.url.includes("127.0.0.1")
    ? "http://localhost:8788"
    : request.url.includes("mildmate-new.pages.dev")
    ? "https://mildmate-new.pages.dev"
    : "https://www.mildmate.com";

  try {
    // Build URLSearchParams manually — Stripe requires array-style encoding for line_items
    const params = new URLSearchParams();
    params.append("customer_email", normalizedEmail);
    params.append("mode", "payment");
    params.append("success_url", `${siteUrl}/order-confirmed/?session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${siteUrl}/checkout/?canceled=true`);
    params.append("metadata[email]", normalizedEmail);
    if (name) params.append("metadata[name]", name);
    if (phone) params.append("metadata[phone]", phone);
    if (address) params.append("metadata[address]", address);
    params.append("metadata[shipping_country_requested]", String(shippingQuote?.requested_country || "").toUpperCase());
    params.append("metadata[shipping_country_applied]", String(shippingQuote?.applied_country || "").toUpperCase());
    params.append("metadata[shipping_country_name]", String(shippingQuote?.country_name || ""));
    params.append("metadata[shipping_service_level]", String(shippingQuote?.service_level || "express"));
    params.append("metadata[shipping_eta_min_days]", String(Number(shippingQuote?.eta_min_days || 0)));
    params.append("metadata[shipping_eta_max_days]", String(Number(shippingQuote?.eta_max_days || 0)));
    params.append("metadata[shipping_eta_note]", String(shippingQuote?.eta_note || ""));
    params.append("metadata[shipping_amount]", String(Number(shippingQuote?.amount || 0)));
    params.append("metadata[shipping_amount_thb]", String(Number(shippingQuote?.amount_thb || 0)));
    params.append("metadata[shipping_currency]", currency.toUpperCase());
    params.append("metadata[shipping_total_qty]", String(totalQty));
    if (discountApplied) {
      params.append("metadata[discount_code]", discountCode);
      params.append("metadata[discount_percent]", String(discountPct));
    }
    const metadataItems = items.map((i: CartItem, idx: number) => ({
      slug: i.product_slug,
      name: i.product_name,
      fabric: i.fabric,
      color: i.color,
      dims: {
        w: i.dimensions?.w,
        l: i.dimensions?.l,
        d: i.dimensions?.d,
        unit: i.dimensions?.unit || "cm",
      },
      qty: i.qty || 1,
      u: lineItems[idx]?.price_data?.unit_amount || 0, // minor unit (cents/satang)
    }));

    let metadataItemsStr = JSON.stringify(metadataItems);
    if (metadataItemsStr.length > 500) {
      const compactItems = items.map((i: CartItem, idx: number) => ({
        s: i.product_slug,
        q: i.qty || 1,
        u: lineItems[idx]?.price_data?.unit_amount || 0,
      }));
      metadataItemsStr = JSON.stringify(compactItems);
    }
    params.append("metadata[items]", metadataItemsStr);
    const appliedShippingCountry = String(shippingQuote?.applied_country || "").toUpperCase();
    const shouldOfferPromptPay =
      currency === "thb" && (origin === "TH" || shippingCountry === "TH" || appliedShippingCountry === "TH");

    if (shouldOfferPromptPay) {
      params.append("payment_method_types[0]", "card");
      params.append("payment_method_types[1]", "promptpay");
    } else {
      params.append("payment_method_types[0]", "card");
    }

    // Encode each line item as Stripe expects: line_items[0][price_data][currency]=usd ...
    lineItems.forEach((li: any, idx: number) => {
      const pd = li.price_data;
      params.append(`line_items[${idx}][price_data][currency]`, pd.currency);
      params.append(`line_items[${idx}][price_data][product_data][name]`, pd.product_data.name);
      if (pd.product_data.description) {
        params.append(`line_items[${idx}][price_data][product_data][description]`, pd.product_data.description);
      }
      params.append(`line_items[${idx}][price_data][unit_amount]`, String(pd.unit_amount));
      params.append(`line_items[${idx}][quantity]`, String(li.quantity));
    });

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const stripeData = await stripeResp.json() as any;

    if (!stripeResp.ok) {
      console.error("Stripe error:", stripeData);
      const stripeMsg =
        stripeData?.error?.message ||
        stripeData?.message ||
        "Payment service error";
      return new Response(JSON.stringify({ error: stripeMsg }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      url: stripeData.url,
      session_id: stripeData.id,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Checkout error:", e.message);
    return new Response(JSON.stringify({ error: "Payment service unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
