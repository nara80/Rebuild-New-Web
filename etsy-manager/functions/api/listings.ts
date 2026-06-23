import { getValidEtsyToken } from "./auth/helper";

interface Env {
  ETTY_CLIENT_ID: string;
  ETSY_CLIENT_ID: string;
  ETSY_CLIENT_SECRET: string;
  DB: D1Database;
  BUCKET: R2Bucket;
}

interface ListingRow {
  id: number;
  etsy_listing_id: string;
  title: string;
  description: string;
  price: number;
  tags: string;
  variations: string;
  images: string;
  last_synced: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  const clientId = env.ETSY_CLIENT_ID || env.ETTY_CLIENT_ID;
  const clientSecret = env.ETSY_CLIENT_SECRET;

  if (method === "GET") {
    const refresh = url.searchParams.get("refresh") === "true";
    const listingId = url.searchParams.get("id");

    // 1. Fetch single listing details with inventory variations and images
    if (listingId) {
      const localListing = await env.DB.prepare(
        "SELECT * FROM listings WHERE etsy_listing_id = ?"
      )
        .bind(listingId)
        .first<ListingRow>();

      if (!localListing) {
        return new Response(JSON.stringify({ error: "Listing not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // If variations are empty or refresh is requested, pull inventory from Etsy API
      if (!localListing.variations || refresh) {
        const token = await getValidEtsyToken(env.DB, clientId, clientSecret);
        if (token) {
          try {
            // Fetch inventory/variations
            const invRes = await fetch(
              `https://openapi.etsy.com/v3/application/listings/${listingId}/inventory`,
              {
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "x-api-key": `${clientId}:${clientSecret}`
                }
              }
            );
            if (invRes.ok) {
              const invData = await invRes.json();
              const variationsStr = JSON.stringify(invData);
              
              // Update D1 cache
              await env.DB.prepare(
                "UPDATE listings SET variations = ? WHERE etsy_listing_id = ?"
              )
                .bind(variationsStr, listingId)
                .run();
              
              localListing.variations = variationsStr;
            }
          } catch (e) {
            console.error("Failed to fetch inventory from Etsy:", e);
          }
        }
      }

      // If images are empty or refresh is requested, pull images from Etsy API
      if (!localListing.images || refresh) {
        const token = await getValidEtsyToken(env.DB, clientId, clientSecret);
        if (token) {
          try {
            const imgRes = await fetch(
              `https://openapi.etsy.com/v3/application/listings/${listingId}/images`,
              {
                headers: {
                  "Authorization": `Bearer ${token}`,
                  "x-api-key": `${clientId}:${clientSecret}`
                }
              }
            );
            if (imgRes.ok) {
              const imgData = (await imgRes.json()) as {
                results: Array<{
                  url_fullxfull: string;
                  listing_image_id: number;
                }>;
              };

              const r2Urls: string[] = [];
              for (const img of imgData.results) {
                const fetchImg = await fetch(img.url_fullxfull);
                if (fetchImg.ok && env.BUCKET) {
                  const r2Key = `etsy-images/${listingId}-${img.listing_image_id}.jpg`;
                  await env.BUCKET.put(r2Key, fetchImg.body, {
                    httpMetadata: { contentType: "image/jpeg" }
                  });
                  r2Urls.push(`/assets/${r2Key}`);
                }
              }
              if (r2Urls.length > 0) {
                const imagesStr = JSON.stringify(r2Urls);
                await env.DB.prepare(
                  "UPDATE listings SET images = ? WHERE etsy_listing_id = ?"
                )
                  .bind(imagesStr, listingId)
                  .run();
                localListing.images = imagesStr;
              }
            } else {
              const errText = await imgRes.text();
              console.error(`Failed to fetch images for listing ${listingId} on single load (Status: ${imgRes.status}, Response: ${errText})`);
            }
          } catch (e) {
            console.error("Failed to fetch images from Etsy for single listing:", e);
          }
        }
      }

      return new Response(JSON.stringify(localListing), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Query local database listings first
    const { results } = await env.DB.prepare("SELECT * FROM listings ORDER BY title ASC").all<ListingRow>();

    if (results.length === 0 || refresh) {
      // Fetch token to call Etsy
      const token = await getValidEtsyToken(env.DB, clientId, clientSecret);
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Etsy connection required", requiresLogin: true }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      try {
        // Find Shop ID
        const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-api-key": `${clientId}:${clientSecret}`
          }
        });
        if (!meRes.ok) {
          const errText = await meRes.text();
          throw new Error(`Failed to fetch Etsy user details (Status: ${meRes.status}, Response: ${errText})`);
        }
        const meData = (await meRes.json()) as { shop_id: number };
        const shopId = meData.shop_id;

        // Fetch all active listings
        const listRes = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/active?limit=100`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
              "x-api-key": `${clientId}:${clientSecret}`
            }
          }
        );
        if (!listRes.ok) throw new Error("Failed to fetch active listings from Etsy");
        const listData = (await listRes.json()) as {
          results: Array<{
            listing_id: number;
            title: string;
            description: string;
            price: { amount: number; divisor: number };
            tags: string[];
          }>;
        };

        const now = new Date().toISOString();

        // Save listings in D1
        for (const item of listData.results) {
          const priceVal = item.price.amount / item.price.divisor;

          // Check if images are already cached in D1
          const existing = await env.DB.prepare("SELECT images FROM listings WHERE etsy_listing_id = ?")
            .bind(String(item.listing_id))
            .first<{ images: string }>();

          let imagesJson = existing ? existing.images : null;

          if (!imagesJson) {
            try {
              // Add a small delay to avoid hitting Etsy API rate limits during bulk sync (5 req/sec limit)
              await new Promise(resolve => setTimeout(resolve, 300));

              // Query Etsy for this listing's images
              const imgRes = await fetch(
                `https://openapi.etsy.com/v3/application/listings/${item.listing_id}/images`,
                {
                  headers: {
                    "Authorization": `Bearer ${token}`,
                    "x-api-key": `${clientId}:${clientSecret}`
                  }
                }
              );
              if (!imgRes.ok) {
                const errText = await imgRes.text();
                console.error(`Failed to fetch images for listing ${item.listing_id} (Status: ${imgRes.status}, Response: ${errText})`);
              } else {
                const imgData = (await imgRes.json()) as {
                  results: Array<{
                    url_fullxfull: string;
                    listing_image_id: number;
                  }>;
                };

                const r2Urls: string[] = [];
                for (const img of imgData.results) {
                  // Fetch fullsize image binary from Etsy CDN
                  const fetchImg = await fetch(img.url_fullxfull);
                  if (fetchImg.ok && env.BUCKET) {
                    const r2Key = `etsy-images/${item.listing_id}-${img.listing_image_id}.jpg`;
                    // Stream upload directly to Cloudflare R2
                    await env.BUCKET.put(r2Key, fetchImg.body, {
                      httpMetadata: { contentType: "image/jpeg" }
                    });
                    r2Urls.push(`/assets/${r2Key}`);
                  }
                }
                if (r2Urls.length > 0) {
                  imagesJson = JSON.stringify(r2Urls);
                }
              }
            } catch (e: any) {
              console.error(`Failed to sync images for listing ${item.listing_id}:`, e);
            }
          }

          await env.DB.prepare(
            `INSERT INTO listings (etsy_listing_id, title, description, price, tags, images, last_synced)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(etsy_listing_id) DO UPDATE SET
               title = excluded.title,
               description = excluded.description,
               price = excluded.price,
               tags = excluded.tags,
               images = COALESCE(listings.images, excluded.images),
               last_synced = excluded.last_synced`
          )
            .bind(
              String(item.listing_id),
              item.title,
              item.description,
              priceVal,
              item.tags ? item.tags.join(",") : "",
              imagesJson,
              now
            )
            .run();
        }

        // Delete listings from D1 that are no longer active on Etsy
        const activeIds = listData.results.map(item => String(item.listing_id));
        if (activeIds.length > 0) {
          const placeholders = activeIds.map(() => "?").join(",");
          await env.DB.prepare(
            `DELETE FROM listings WHERE etsy_listing_id NOT IN (${placeholders})`
          )
            .bind(...activeIds)
            .run();
        } else {
          await env.DB.prepare("DELETE FROM listings").run();
        }

        // Return newly updated results from D1
        const freshList = await env.DB.prepare("SELECT * FROM listings ORDER BY title ASC").all<ListingRow>();
        return new Response(JSON.stringify(freshList.results), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (method === "PUT") {
    // 3. Update listing locally and sync to Etsy
    try {
      const body = (await request.json()) as {
        etsy_listing_id: string;
        title: string;
        description: string;
        price: number;
        tags: string;
        images?: string; // stringified JSON array of image URLs
        variations?: string; // stringified JSON representing Etsy inventory payload
        sync_to_etsy: boolean;
      };

      const now = new Date().toISOString();

      // Update locally in D1 database
      await env.DB.prepare(
        `UPDATE listings 
         SET title = ?, description = ?, price = ?, tags = ?, variations = ?, images = ?, last_synced = ? 
         WHERE etsy_listing_id = ?`
      )
        .bind(
          body.title,
          body.description,
          body.price,
          body.tags,
          body.variations || null,
          body.images || null,
          now,
          body.etsy_listing_id
        )
        .run();

      if (body.sync_to_etsy) {
        const token = await getValidEtsyToken(env.DB, clientId, clientSecret);
        if (!token) {
          return new Response(
            JSON.stringify({ error: "Etsy authentication required to sync listings" }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" }
            }
          );
        }

        // Find Shop ID
        const meRes = await fetch("https://openapi.etsy.com/v3/application/users/me", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-api-key": `${clientId}:${clientSecret}`
          }
        });
        if (!meRes.ok) {
          const errText = await meRes.text();
          throw new Error(`Failed to fetch Etsy user details for sync (Status: ${meRes.status}, Response: ${errText})`);
        }
        const meData = (await meRes.json()) as { shop_id: number };
        const shopId = meData.shop_id;

        // A. Update basic details on Etsy
        const updateParams = {
          title: body.title,
          description: body.description,
          tags: body.tags ? body.tags.split(",").map(t => t.trim()).filter(Boolean) : []
        };

        const patchRes = await fetch(
          `https://openapi.etsy.com/v3/application/shops/${shopId}/listings/${body.etsy_listing_id}`,
          {
            method: "PATCH",
            headers: {
              "Authorization": `Bearer ${token}`,
              "x-api-key": `${clientId}:${clientSecret}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(updateParams)
          }
        );

        if (!patchRes.ok) {
          const patchErr = await patchRes.text();
          throw new Error(`Etsy Metadata Update failed: ${patchErr}`);
        }

        // B. Update Variations/Inventory on Etsy if variations data is supplied
        if (body.variations) {
          const invPayload = cleanInventoryPayload(JSON.parse(body.variations));
          
          const invRes = await fetch(
            `https://openapi.etsy.com/v3/application/listings/${body.etsy_listing_id}/inventory`,
            {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${token}`,
                "x-api-key": `${clientId}:${clientSecret}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(invPayload)
            }
          );

          if (!invRes.ok) {
            const invErr = await invRes.text();
            throw new Error(`Etsy Inventory/Variation update failed: ${invErr}`);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, synced: body.sync_to_etsy }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

function cleanInventoryPayload(inventory: any): any {
  if (!inventory || !inventory.products) return inventory;

  const cleaned = JSON.parse(JSON.stringify(inventory));

  if (Array.isArray(cleaned.products)) {
    cleaned.products = cleaned.products.map((prod: any) => {
      const cleanedProd: any = {
        sku: prod.sku || ""
      };

      if (Array.isArray(prod.offerings)) {
        cleanedProd.offerings = prod.offerings.map((off: any) => {
          const cleanedOff: any = {
            quantity: off.quantity !== undefined ? off.quantity : 1,
            is_enabled: off.is_enabled !== undefined ? off.is_enabled : true
          };

          if (off.price !== undefined && off.price !== null) {
            if (typeof off.price === "object") {
              cleanedOff.price = off.price.amount / off.price.divisor;
            } else {
              cleanedOff.price = parseFloat(off.price);
            }
          }

          if (off.readiness_state_id !== undefined && off.readiness_state_id !== null) {
            cleanedOff.readiness_state_id = off.readiness_state_id;
          }

          return cleanedOff;
        });
      }

      if (Array.isArray(prod.property_values)) {
        cleanedProd.property_values = prod.property_values.map((pv: any) => {
          const cleanedPv: any = {
            property_id: pv.property_id,
            property_name: pv.property_name || "",
            value_ids: pv.value_ids
          };
          if (pv.values) {
            cleanedPv.values = pv.values;
          }
          if (pv.scale_id !== undefined) {
            cleanedPv.scale_id = pv.scale_id;
          }
          return cleanedPv;
        });
      }

      return cleanedProd;
    });
  }

  return {
    products: cleaned.products,
    price_on_property: cleaned.price_on_property,
    quantity_on_property: cleaned.quantity_on_property,
    sku_on_property: cleaned.sku_on_property
  };
}
