// MildMate Geo & Currency API
// Detects visitor location via Cloudflare headers, returns currency

interface GeoResult {
  country: string | null;
  country_name: string | null;
  currency: "USD" | "THB";
  is_thailand: boolean;
}

const COUNTRY_NAMES: Record<string, string> = {
  // Asia-Pacific
  TH: "Thailand", JP: "Japan", KR: "South Korea", CN: "China",
  TW: "Taiwan", HK: "Hong Kong", SG: "Singapore", MY: "Malaysia",
  ID: "Indonesia", PH: "Philippines", VN: "Vietnam", IN: "India",
  PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka", MM: "Myanmar",
  KH: "Cambodia", LA: "Laos", NP: "Nepal", MN: "Mongolia",
  AU: "Australia", NZ: "New Zealand",
  // Europe
  GB: "United Kingdom", DE: "Germany", FR: "France", IT: "Italy",
  ES: "Spain", NL: "Netherlands", BE: "Belgium", AT: "Austria",
  CH: "Switzerland", SE: "Sweden", NO: "Norway", DK: "Denmark",
  FI: "Finland", IE: "Ireland", PT: "Portugal", PL: "Poland",
  CZ: "Czech Republic", GR: "Greece", HU: "Hungary", RO: "Romania",
  BG: "Bulgaria", HR: "Croatia", TR: "Turkey", UA: "Ukraine",
  IL: "Israel", RU: "Russia",
  // Americas
  US: "United States", CA: "Canada", MX: "Mexico", BR: "Brazil",
  AR: "Argentina", CL: "Chile", CO: "Colombia", PE: "Peru",
  // Middle East & Africa
  AE: "United Arab Emirates", SA: "Saudi Arabia", QA: "Qatar",
  KW: "Kuwait", OM: "Oman", BH: "Bahrain",
  ZA: "South Africa", EG: "Egypt", NG: "Nigeria", KE: "Kenya",
  MA: "Morocco",
};

export function detectGeo(request: Request): GeoResult {
  const headers = request.headers;
  const country = headers.get("CF-IPCountry") || headers.get("cf-ipcountry") || null;
  const isThailand = country === "TH";

  return {
    country,
    country_name: country ? (COUNTRY_NAMES[country] || null) : null,
    currency: isThailand ? "THB" : "USD",
    is_thailand: isThailand,
  };
}

export async function handleGeo(request: Request, env: any): Promise<Response> {
  const result = detectGeo(request);
  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=60",
      "CDN-Cache-Control": "no-cache",
    },
  });
}
