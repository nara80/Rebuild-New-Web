// MildMate Pricing API
// Calculates live price for Fitted Bed Sheet AND V-Berth modes

const FABRIC_RATES: Record<string, { usd: number; thb: number }> = {
  breezeplus: { usd: 0.0016, thb: 0.057 },
  cloudsoft: { usd: 0.0014, thb: 0.050 },
  premacotton: { usd: 0.0018, thb: 0.064 },
  ecoluxe: { usd: 0.0020, thb: 0.071 },
};

const BASE_PRICES: Record<string, { usd: number; thb: number }> = {
  sheet: { usd: 45, thb: 1590 },
  vberth: { usd: 55, thb: 1945 },
};

interface PricingInput {
  mode: "sheet" | "vberth";
  fabric: string;
  unit: "cm" | "inch";
  width?: number;
  length?: number;
  depth?: number;
  head?: number;
  foot?: number;
}

function cmToInch(val: number): number {
  return val * 0.393701;
}

function inchToCm(val: number): number {
  return val * 2.54;
}

export function calculatePrice(input: PricingInput, currency: "USD" | "THB" = "USD"): number {
  const rateKey = currency.toLowerCase() as "usd" | "thb";
  const fabricRate = FABRIC_RATES[input.fabric]?.[rateKey] || FABRIC_RATES.breezeplus[rateKey];
  const base = BASE_PRICES[input.mode]?.[rateKey] || BASE_PRICES.sheet[rateKey];

  let w = input.width || 0;
  let l = input.length || 0;
  let head = input.head || 0;
  let foot = input.foot || 0;

  // Convert to cm for calculation if inputs are in inches
  if (input.unit === "inch") {
    w = inchToCm(w);
    l = inchToCm(l);
    head = inchToCm(head);
    foot = inchToCm(foot);
  }

  let area = 0;
  if (input.mode === "sheet" && w > 0 && l > 0) {
    area = w * l;
  } else if (input.mode === "vberth" && head > 0 && foot > 0 && l > 0) {
    area = ((head + foot) / 2) * l;
  }

  const standardArea = 160 * 200; // standard single mattress area
  const extra = Math.max(0, area - standardArea) * fabricRate;
  return Math.round((base + extra) * 100) / 100;
}

export async function handlePricing(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/pricing" || path === "/api/pricing/") {
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      let body: PricingInput;
      if (request.method === "POST") {
        body = await request.json();
      } else {
        const params = url.searchParams;
        body = {
          mode: (params.get("mode") as "sheet" | "vberth") || "sheet",
          fabric: params.get("fabric") || "breezeplus",
          unit: (params.get("unit") as "cm" | "inch") || "cm",
          width: parseFloat(params.get("width") || "0") || undefined,
          length: parseFloat(params.get("length") || "0") || undefined,
          depth: parseFloat(params.get("depth") || "0") || undefined,
          head: parseFloat(params.get("head") || "0") || undefined,
          foot: parseFloat(params.get("foot") || "0") || undefined,
        };
      }

      const priceUsd = calculatePrice(body, "USD");
      const priceThb = calculatePrice(body, "THB");

      return new Response(
        JSON.stringify({
          price_usd: priceUsd,
          price_thb: priceThb,
          mode: body.mode,
          fabric: body.fabric,
          unit: body.unit,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message || "Calculation error" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}
