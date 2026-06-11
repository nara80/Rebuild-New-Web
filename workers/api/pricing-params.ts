// MildMate Public API — Pricing Parameters
// Returns all adjustable formula constants + exchange rates + DIY prices
// GET /api/pricing-params

export async function handlePricingParams(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // GET /api/pricing-params — full params dump
  if (request.method === "GET" && path === "/api/pricing-params") {
    const { results: params } = await env.DB.prepare(
      "SELECT key, value, label, category FROM pricing_params ORDER BY category, key"
    ).all();

    const { results: rates } = await env.DB.prepare(
      "SELECT currency, rate_per_thb, label, symbol FROM exchange_rates ORDER BY currency"
    ).all();

    // Transform flat params into nested structure for easy JS consumption
    const fabricRates: Record<string, number> = {};
    const margins: Record<string, number> = {};
    const sewingTiers: Array<{ max: number; cost: number }> = [];
    const duvetSewingTiers: Array<{ max: number; cost: number }> = [];
    const protectorFabricTiers: Array<{ max: number; cost: number }> = [];
    const protectorDepthTiers: Array<{ min: number; cost: number }> = [];
    const fixed: Record<string, number> = {};

    for (const row of (params as any[])) {
      const k = row.key as string;
      const v = row.value as number;
      if (k.startsWith("fabric_rate_")) {
        fabricRates[k.replace("fabric_rate_", "")] = v;
      } else if (k.startsWith("margin_rate_")) {
        margins[k.replace("margin_rate_", "")] = v;
      } else if (k.startsWith("sewing_tier")) {
        // sewing_tier1_max, sewing_tier1_cost, etc.
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/tier(\d+)_cost/)![1];
          const maxKey = `sewing_tier${tierNum}_max`;
          const maxRow = (params as any[]).find((r: any) => r.key === maxKey);
          sewingTiers.push({ max: maxRow ? maxRow.value : Infinity, cost: v });
        }
      } else if (k.startsWith("duvet_sewing_tier")) {
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/duvet_sewing_tier(\d+)_cost/)![1];
          const maxKey = `duvet_sewing_tier${tierNum}_max`;
          const maxRow = (params as any[]).find((r: any) => r.key === maxKey);
          duvetSewingTiers.push({ max: maxRow ? maxRow.value : Infinity, cost: v });
        }
      } else if (k.startsWith("protector_fabric_tier")) {
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/protector_fabric_tier(\d+)_cost/)![1];
          const maxKey = `protector_fabric_tier${tierNum}_max`;
          const maxRow = (params as any[]).find((r: any) => r.key === maxKey);
          protectorFabricTiers.push({ max: maxRow ? maxRow.value : Infinity, cost: v });
        }
      } else if (k.startsWith("protector_depth_tier")) {
        if (k.endsWith("_cost")) {
          const tierNum = k.match(/protector_depth_tier(\d+)_cost/)![1];
          const minKey = `protector_depth_tier${tierNum}_min`;
          const minRow = (params as any[]).find((r: any) => r.key === minKey);
          protectorDepthTiers.push({ min: minRow ? minRow.value : 0, cost: v });
        }
      } else {
        fixed[k] = v;
      }
    }

    return new Response(JSON.stringify({
      fabric_rates: fabricRates,
      margins,
      sewing_tiers: sewingTiers.sort((a, b) => a.max - b.max),
      duvet_sewing_tiers: duvetSewingTiers.sort((a, b) => a.max - b.max),
      protector_fabric_tiers: protectorFabricTiers.sort((a, b) => a.max - b.max),
      protector_depth_tiers: protectorDepthTiers.sort((a, b) => a.min - b.min),
      fixed_costs: fixed,
      exchange_rates: rates,
    }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  }

  // GET /api/diy-prices?product=marine-fitted-sheet
  if (request.method === "GET" && path === "/api/diy-prices") {
    const product = url.searchParams.get("product") || "";
    let query = "SELECT shape_code, size_key, price_thb, price_usd, label FROM diy_prices";
    const bindings: any[] = [];
    if (product) {
      query += " WHERE product_slug = ?";
      bindings.push(product);
    }
    query += " ORDER BY product_slug, shape_code, size_key";
    const { results } = await env.DB.prepare(query).bind(...bindings).all();
    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  }

  return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
}
