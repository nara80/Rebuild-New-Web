const FIXED_PRODUCT_SLUGS = new Set([
  "bedbridge-connector",
  "mattress-lift-helper",
  "duvet-insert"
]);

const TYPE_LABELS_EN: Record<string, string> = {
  sheets: "SHEETS",
  "duvet-covers": "DUVET COVERS",
  pillowcases: "PILLOWCASES",
  protection: "PROTECTION",
  accessories: "ACCESSORIES"
};

const TYPE_LABELS_TH: Record<string, string> = {
  sheets: "ผ้าปูที่นอน",
  "duvet-covers": "ปลอกผ้านวม",
  pillowcases: "ปลอกหมอน",
  protection: "อุปกรณ์ป้องกัน",
  accessories: "อุปกรณ์เสริม"
};

const NICHE_LABELS_EN: Record<string, string> = {
  marine: "MARINE & YACHT",
  family: "FAMILY & CO-SLEEP",
  "deep-pocket": "DEEP POCKET",
  pets: "PET FRIENDLY",
  "boarding-dorm": "DORM & STUDENT",
  "rv-truck": "RV & TRUCK"
};

const NICHE_LABELS_TH: Record<string, string> = {
  marine: "เรือและยอชต์",
  family: "ครอบครัวและนอนร่วม",
  "deep-pocket": "ที่นอนหนาพิเศษ",
  pets: "เป็นมิตรกับสัตว์เลี้ยง",
  "boarding-dorm": "หอพักและนักเรียน",
  "rv-truck": "RV และรถบรรทุก"
};

const NICHE_PATHS: Record<string, string> = {
  marine: "/marine/",
  family: "/family/",
  "deep-pocket": "/deep-pocket/",
  pets: "/pets/",
  "boarding-dorm": "/boarding-dorm/",
  "rv-truck": "/rv-truck/"
};

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toTokens(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function normalizeImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("/r2/")) {
    return `https://pub-1739fdf11fd0474f982b7a9f30f77669.r2.dev${url.slice(3)}`;
  }
  return url;
}

function firstSentence(text: string, maxLen = 110): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentence = clean.split(/[.!?]/)[0].trim();
  if (sentence.length <= maxLen) return sentence;
  return `${sentence.slice(0, maxLen - 1).trimEnd()}…`;
}

function buildFabricInfo(fabricOptions: string, isFixed: boolean, isTh: boolean): string {
  if (isFixed) return isTh ? "สเปกตายตัว" : "Fixed specification";
  const fabrics = toTokens(fabricOptions);
  if (fabrics.length <= 1) return isTh ? "ขนาดสั่งตัด · หลายสี" : "Custom size · Multiple colors";
  if (isTh) return `${fabrics.length} ชนิดผ้า · หลายสี`;
  return `${fabrics.length} fabrics · Multiple colors`;
}

function buildButtonLabel(isFixed: boolean, isTh: boolean): string {
  if (isFixed) return isTh ? "ดูรายละเอียด" : "View Details";
  return isTh ? "เลือกขนาดและผ้า" : "Choose Size & Fabric";
}

function buildPrice(product: any, isTh: boolean): { display: string; usd: number; thb: number } {
  const usdRaw = Number(product.base_price_usd);
  const thbRaw = Number(product.base_price_thb);
  const usd = Number.isFinite(usdRaw) && usdRaw > 0 ? Math.round(usdRaw) : (Number.isFinite(thbRaw) && thbRaw > 0 ? Math.round(thbRaw / 35) : 0);
  const thb = Number.isFinite(thbRaw) && thbRaw > 0 ? Math.round(thbRaw) : usd * 35;
  const display = isTh ? `เริ่มต้น ฿${thb}` : `From US$${usd}`;
  return { display, usd, thb };
}

function getCategoryTokens(product: any): string[] {
  const merged = new Set<string>();
  toTokens(product.product_type).forEach((t) => merged.add(t));
  toTokens(product.niches).forEach((t) => merged.add(t));
  toTokens(product.category).forEach((t) => merged.add(t));
  return Array.from(merged);
}

function buildCard(product: any, isTh: boolean): string {
  const slug = String(product.slug || "").trim();
  const title = escapeHtml(String((isTh ? product.title_th : product.title_en) || product.title_en || slug && titleFromSlug(slug) || "Product"));
  const description = String((isTh ? product.description_th : product.description_en) || product.description_en || "");
  const cardBenefit = String((isTh ? product.card_benefit_th : product.card_benefit_en) || product.card_benefit_en || "");
  const benefit = escapeHtml(firstSentence(cardBenefit || description, 120) || (isTh ? "สินค้าออกแบบตามขนาดที่ต้องการ" : "Custom-made for your exact dimensions"));
  const isFixed = FIXED_PRODUCT_SLUGS.has(slug) || Number(product.is_custom) === 0;
  const categories = getCategoryTokens(product);
  const productType = categories.find((c) => !!TYPE_LABELS_EN[c]) || "sheets";
  const niche = categories.find((c) => !!NICHE_LABELS_EN[c]);
  const dataCategories = escapeHtml(categories.join(","));
  const labels = isTh ? TYPE_LABELS_TH : TYPE_LABELS_EN;
  const nicheLabels = isTh ? NICHE_LABELS_TH : NICHE_LABELS_EN;
  const typeTagLabel = labels[productType] || "PRODUCT";
  const nicheTagLabel = niche ? nicheLabels[niche] : "";
  const nichePathBase = niche ? (NICHE_PATHS[niche] || "/products/") : "/products/";
  const nichePath = isTh ? `/th${nichePathBase}` : nichePathBase;
  const image = escapeHtml(normalizeImageUrl(String(product.image_url || "")) || `/images/products/${slug}/main.jpg`);
  const price = buildPrice(product, isTh);
  const buttonLabel = escapeHtml(buildButtonLabel(isFixed, isTh));
  const fabricInfo = escapeHtml(buildFabricInfo(String(product.fabric_options || ""), isFixed, isTh));
  const priceNote = isTh ? "ไม่รวมค่าขนส่ง ภาษี และค่าธรรมเนียม" : "Excludes shipping, tax & tariff";
  const titleLower = escapeHtml(String(product.title_en || title).toLowerCase());

  return `          <article class="product-card" data-categories="${dataCategories}" data-title="${titleLower}" data-price="${price.usd}">
            <div class="product-image">
              <img src="${image}" alt="${title}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="product-info">
              <div class="product-tags" aria-label="Categories"><a href="/${productType}/" class="card-tag" style="text-decoration:none;">${escapeHtml(typeTagLabel)}</a>${nicheTagLabel ? `<a href="${escapeHtml(nichePath)}" class="card-tag" style="text-decoration:none;">${escapeHtml(nicheTagLabel)}</a>` : ""}</div>
              <h3 class="product-title">${title}</h3>
              <div class="product-price" data-usd="${price.usd}" data-thb="${price.thb}">${escapeHtml(price.display)}</div>
              <div class="product-price-note">${escapeHtml(priceNote)}</div>
              <p class="product-benefit">${benefit}</p>
              <div class="product-fabrics-info">${fabricInfo}</div>
              <a href="${isTh ? "/th" : ""}/product/${escapeHtml(slug)}/" class="btn btn-primary" style="margin-top:auto;">${buttonLabel}</a>
            </div>
          </article>`;
}

export async function onRequest(context: any): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const isEnProducts = path === "/products/" || path === "/products";
  const isThProducts = path === "/th/products/" || path === "/th/products";
  if (!isEnProducts && !isThProducts) {
    return next();
  }

  try {
    const staticUrl = `${url.origin}${isThProducts ? "/th/products/index.html" : "/products/index.html"}`;
    const staticRes = await env.ASSETS.fetch(new Request(staticUrl));
    if (!staticRes.ok) return next();
    let html = await staticRes.text();

    const query = env.DB.prepare(`
      SELECT
        slug,
        title_en,
        title_th,
        description_en,
        description_th,
        card_benefit_en,
        card_benefit_th,
        category,
        product_type,
        niches,
        fabric_options,
        base_price_usd,
        base_price_thb,
        image_url,
        is_custom,
        is_active,
        sort_order
      FROM products
      WHERE COALESCE(is_active, 1) = 1
      ORDER BY COALESCE(sort_order, 9999), title_en
    `);
    const result = await query.all();
    const products = Array.isArray(result?.results) ? result.results : [];
    const cardsHtml = products.map((p: any) => buildCard(p, isThProducts)).join("\n");

    html = html.replace(
      /<!-- PRODUCTS_GRID_START -->[\s\S]*?<!-- PRODUCTS_GRID_END -->/m,
      `<!-- PRODUCTS_GRID_START -->\n${cardsHtml}\n          <!-- PRODUCTS_GRID_END -->`
    );

    const countText = isThProducts ? `${products.length} สินค้า` : `${products.length} products`;
    html = html.replace(
      /(<div class="results-count" id="results-count">)[\s\S]*?(<\/div>)/i,
      `$1${countText}$2`
    );

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300"
      }
    });
  } catch (error) {
    console.error("Products SSR error:", error);
    return next();
  }
}
