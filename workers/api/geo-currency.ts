// MildMate Geo & Currency API
// Detects visitor location via Cloudflare headers, returns currency

interface GeoResult {
  country: string | null;
  country_name: string | null;
  currency: "USD" | "THB";
  is_thailand: boolean;
}

export function detectGeo(request: Request): GeoResult {
  const headers = request.headers;
  const country = headers.get("CF-IPCountry") || headers.get("cf-ipcountry") || null;
  const isThailand = country === "TH";

  return {
    country,
    country_name: isThailand ? "Thailand" : null,
    currency: isThailand ? "THB" : "USD",
    is_thailand: isThailand,
  };
}

export async function handleGeo(request: Request, env: any): Promise<Response> {
  const result = detectGeo(request);
  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
    },
  });
}
