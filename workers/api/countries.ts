// MildMate Countries API — centralized country master list (D1-backed)
// GET /api/countries?include_fallback=1

type CountrySeed = {
  code: string;
  name: string;
  phone: string;
  fallback?: boolean;
};

const MASTER_COUNTRIES: CountrySeed[] = [
  { code: "AF", name: "Afghanistan", phone: "+93" },
  { code: "AL", name: "Albania", phone: "+355" },
  { code: "DZ", name: "Algeria", phone: "+213" },
  { code: "AD", name: "Andorra", phone: "+376" },
  { code: "AO", name: "Angola", phone: "+244" },
  { code: "AR", name: "Argentina", phone: "+54" },
  { code: "AM", name: "Armenia", phone: "+374" },
  { code: "AU", name: "Australia", phone: "+61" },
  { code: "AT", name: "Austria", phone: "+43" },
  { code: "AZ", name: "Azerbaijan", phone: "+994" },
  { code: "BH", name: "Bahrain", phone: "+973" },
  { code: "BD", name: "Bangladesh", phone: "+880" },
  { code: "BY", name: "Belarus", phone: "+375" },
  { code: "BE", name: "Belgium", phone: "+32" },
  { code: "BT", name: "Bhutan", phone: "+975" },
  { code: "BO", name: "Bolivia", phone: "+591" },
  { code: "BA", name: "Bosnia", phone: "+387" },
  { code: "BR", name: "Brazil", phone: "+55" },
  { code: "BN", name: "Brunei", phone: "+673" },
  { code: "BG", name: "Bulgaria", phone: "+359" },
  { code: "KH", name: "Cambodia", phone: "+855" },
  { code: "CM", name: "Cameroon", phone: "+237" },
  { code: "CA", name: "Canada", phone: "+1" },
  { code: "CL", name: "Chile", phone: "+56" },
  { code: "CN", name: "China", phone: "+86" },
  { code: "CO", name: "Colombia", phone: "+57" },
  { code: "CR", name: "Costa Rica", phone: "+506" },
  { code: "HR", name: "Croatia", phone: "+385" },
  { code: "CY", name: "Cyprus", phone: "+357" },
  { code: "CZ", name: "Czech Republic", phone: "+420" },
  { code: "DK", name: "Denmark", phone: "+45" },
  { code: "EC", name: "Ecuador", phone: "+593" },
  { code: "EG", name: "Egypt", phone: "+20" },
  { code: "EE", name: "Estonia", phone: "+372" },
  { code: "ET", name: "Ethiopia", phone: "+251" },
  { code: "FI", name: "Finland", phone: "+358" },
  { code: "FR", name: "France", phone: "+33" },
  { code: "GE", name: "Georgia", phone: "+995" },
  { code: "DE", name: "Germany", phone: "+49" },
  { code: "GR", name: "Greece", phone: "+30" },
  { code: "HK", name: "Hong Kong", phone: "+852" },
  { code: "HU", name: "Hungary", phone: "+36" },
  { code: "IS", name: "Iceland", phone: "+354" },
  { code: "IN", name: "India", phone: "+91" },
  { code: "ID", name: "Indonesia", phone: "+62" },
  { code: "IR", name: "Iran", phone: "+98" },
  { code: "IQ", name: "Iraq", phone: "+964" },
  { code: "IE", name: "Ireland", phone: "+353" },
  { code: "IL", name: "Israel", phone: "+972" },
  { code: "IT", name: "Italy", phone: "+39" },
  { code: "JP", name: "Japan", phone: "+81" },
  { code: "JO", name: "Jordan", phone: "+962" },
  { code: "KZ", name: "Kazakhstan", phone: "+7" },
  { code: "KE", name: "Kenya", phone: "+254" },
  { code: "KW", name: "Kuwait", phone: "+965" },
  { code: "LA", name: "Laos", phone: "+856" },
  { code: "LV", name: "Latvia", phone: "+371" },
  { code: "LB", name: "Lebanon", phone: "+961" },
  { code: "LT", name: "Lithuania", phone: "+370" },
  { code: "LU", name: "Luxembourg", phone: "+352" },
  { code: "MY", name: "Malaysia", phone: "+60" },
  { code: "MV", name: "Maldives", phone: "+960" },
  { code: "MT", name: "Malta", phone: "+356" },
  { code: "MX", name: "Mexico", phone: "+52" },
  { code: "MC", name: "Monaco", phone: "+377" },
  { code: "MN", name: "Mongolia", phone: "+976" },
  { code: "MA", name: "Morocco", phone: "+212" },
  { code: "MM", name: "Myanmar", phone: "+95" },
  { code: "NP", name: "Nepal", phone: "+977" },
  { code: "NL", name: "Netherlands", phone: "+31" },
  { code: "NZ", name: "New Zealand", phone: "+64" },
  { code: "NG", name: "Nigeria", phone: "+234" },
  { code: "NO", name: "Norway", phone: "+47" },
  { code: "OM", name: "Oman", phone: "+968" },
  { code: "PK", name: "Pakistan", phone: "+92" },
  { code: "PA", name: "Panama", phone: "+507" },
  { code: "PE", name: "Peru", phone: "+51" },
  { code: "PH", name: "Philippines", phone: "+63" },
  { code: "PL", name: "Poland", phone: "+48" },
  { code: "PT", name: "Portugal", phone: "+351" },
  { code: "QA", name: "Qatar", phone: "+974" },
  { code: "RO", name: "Romania", phone: "+40" },
  { code: "RU", name: "Russia", phone: "+7" },
  { code: "SA", name: "Saudi Arabia", phone: "+966" },
  { code: "RS", name: "Serbia", phone: "+381" },
  { code: "SG", name: "Singapore", phone: "+65" },
  { code: "SK", name: "Slovakia", phone: "+421" },
  { code: "SI", name: "Slovenia", phone: "+386" },
  { code: "ZA", name: "South Africa", phone: "+27" },
  { code: "KR", name: "South Korea", phone: "+82" },
  { code: "ES", name: "Spain", phone: "+34" },
  { code: "LK", name: "Sri Lanka", phone: "+94" },
  { code: "SE", name: "Sweden", phone: "+46" },
  { code: "CH", name: "Switzerland", phone: "+41" },
  { code: "TW", name: "Taiwan", phone: "+886" },
  { code: "TZ", name: "Tanzania", phone: "+255" },
  { code: "TH", name: "Thailand", phone: "+66" },
  { code: "TR", name: "Turkey", phone: "+90" },
  { code: "AE", name: "UAE", phone: "+971" },
  { code: "UG", name: "Uganda", phone: "+256" },
  { code: "UA", name: "Ukraine", phone: "+380" },
  { code: "GB", name: "United Kingdom", phone: "+44" },
  { code: "US", name: "United States", phone: "+1" },
  { code: "UY", name: "Uruguay", phone: "+598" },
  { code: "UZ", name: "Uzbekistan", phone: "+998" },
  { code: "VE", name: "Venezuela", phone: "+58" },
  { code: "VN", name: "Vietnam", phone: "+84" },
  { code: "YE", name: "Yemen", phone: "+967" },
  { code: "ZW", name: "Zimbabwe", phone: "+263" },
  { code: "OTHER", name: "Other Countries", phone: "", fallback: true },
];

let countryMasterReady = false;
let countryMasterPromise: Promise<void> | null = null;

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function ensureCountryMasterSchema(env: any): Promise<void> {
  if (countryMasterReady) return;
  if (!countryMasterPromise) {
    countryMasterPromise = (async () => {
      await env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS countries_master (
          country_code TEXT PRIMARY KEY,
          country_name TEXT NOT NULL,
          phone_code TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          is_fallback INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT (datetime('now'))
        )`
      ).run();

      for (let i = 0; i < MASTER_COUNTRIES.length; i++) {
        const c = MASTER_COUNTRIES[i];
        await env.DB.prepare(
          `INSERT OR IGNORE INTO countries_master (
            country_code, country_name, phone_code, is_active, is_fallback, sort_order, updated_at
          ) VALUES (?1, ?2, ?3, 1, ?4, ?5, datetime('now'))`
        ).bind(c.code, c.name, c.phone || "", c.fallback ? 1 : 0, i + 1).run();
      }
      countryMasterReady = true;
    })().finally(() => {
      if (!countryMasterReady) countryMasterPromise = null;
    });
  }
  await countryMasterPromise;
}

export async function handleCountries(request: Request, env: any): Promise<Response> {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    await ensureCountryMasterSchema(env);
    const url = new URL(request.url);
    const includeFallback = url.searchParams.get("include_fallback") === "1";

    const rows = await env.DB.prepare(
      `SELECT country_code, country_name, phone_code, is_fallback
       FROM countries_master
       WHERE is_active = 1
         AND (?1 = 1 OR is_fallback = 0)
       ORDER BY sort_order ASC, country_name ASC`
    ).bind(includeFallback ? 1 : 0).all();

    const countries = (rows.results || []).map((r: any) => ({
      code: String(r.country_code || "").toUpperCase(),
      name: String(r.country_name || "").trim(),
      phone: String(r.phone_code || "").trim(),
      is_fallback: Number(r.is_fallback || 0) === 1,
    }));

    return json({ countries });
  } catch (e: any) {
    return json({ error: e?.message || "Countries unavailable" }, 500);
  }
}
