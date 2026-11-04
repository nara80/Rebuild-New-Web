const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'https://www.mildmate.com';
const OUT_DIR = 'D:/00_mildmate/re-build_web/00_Issue/product-image-performance-audit-20261103';
const PRODUCT_CSV = path.join(OUT_DIR, 'PRODUCT_IMAGE_INVENTORY.csv');
const ASSET_CSV = path.join(OUT_DIR, 'IMAGE_ASSET_INVENTORY.csv');
const SUMMARY_JSON = path.join(OUT_DIR, 'audit-summary.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv(rows, headers) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  return lines.join('\n');
}

function parseLocs(xml) {
  const locs = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return locs;
}

function extractAttr(tag, name) {
  const re = new RegExp(name + "\\s*=\\s*(['\"])(.*?)\\1", 'i');
  const m = tag.match(re);
  return m ? m[2] : '';
}

function normalizeAssetUrl(src, pageUrl) {
  if (!src) return null;
  const s = src.trim();
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return null;
  try {
    return new URL(s, pageUrl).href;
  } catch {
    return null;
  }
}

function isProductRelatedAsset(absUrl) {
  if (!absUrl) return false;
  return (
    absUrl.includes('/images/products/') ||
    absUrl.includes('r2.dev/products/') ||
    absUrl.includes('/images/placeholder')
  );
}

function parseImagesField(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  const txt = String(raw);
  try {
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {}
  try {
    const arr = JSON.parse(txt.replace(/\\"/g, '"'));
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {}
  return [];
}

function parseFormat(contentType, url) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('image/jpeg')) return 'jpeg';
  if (ct.includes('image/png')) return 'png';
  if (ct.includes('image/webp')) return 'webp';
  if (ct.includes('image/avif')) return 'avif';
  if (ct.includes('image/gif')) return 'gif';
  const ext = (url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/) || [,''])[1].toLowerCase();
  return ext || 'unknown';
}

function parsePngDimensions(buf) {
  if (buf.length < 24) return null;
  const sig = '89504e470d0a1a0a';
  if (buf.subarray(0,8).toString('hex') !== sig) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function parseGifDimensions(buf) {
  if (buf.length < 10) return null;
  const hdr = buf.subarray(0,6).toString('ascii');
  if (hdr !== 'GIF87a' && hdr !== 'GIF89a') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function parseWebpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.subarray(0,4).toString('ascii') !== 'RIFF' || buf.subarray(8,12).toString('ascii') !== 'WEBP') return null;
  const chunk = buf.subarray(12,16).toString('ascii');
  if (chunk === 'VP8X' && buf.length >= 30) {
    const w = 1 + buf.readUIntLE(24, 3);
    const h = 1 + buf.readUIntLE(27, 3);
    return { width: w, height: h };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    const start = 20;
    if (buf[start + 3] === 0x9d && buf[start + 4] === 0x01 && buf[start + 5] === 0x2a) {
      const w = buf.readUInt16LE(start + 6) & 0x3fff;
      const h = buf.readUInt16LE(start + 8) & 0x3fff;
      return { width: w, height: h };
    }
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
    const w = 1 + (((b1 & 0x3f) << 8) | b0);
    const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { width: w, height: h };
  }
  return null;
}

function parseJpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) { offset++; continue; }
    const marker = buf[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = buf.readUInt16BE(offset + 2);
    if (len < 2 || offset + 2 + len > buf.length) break;
    const isSOF = (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    );
    if (isSOF) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + len;
  }
  return null;
}

function parseDimensionsFromBytes(buf, formatHint) {
  return (
    (formatHint === 'png' ? parsePngDimensions(buf) : null) ||
    (formatHint === 'gif' ? parseGifDimensions(buf) : null) ||
    (formatHint === 'webp' ? parseWebpDimensions(buf) : null) ||
    (formatHint === 'jpeg' || formatHint === 'jpg' ? parseJpegDimensions(buf) : null) ||
    parsePngDimensions(buf) ||
    parseWebpDimensions(buf) ||
    parseGifDimensions(buf) ||
    parseJpegDimensions(buf)
  );
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      out[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

function rolePriority(roleSet, usedAsHero, cacheControl, estBytes) {
  if (usedAsHero && estBytes > 40 * 1024) return 'P0';
  if ((roleSet.has('gallery-thumb') || roleSet.has('gallery-slide')) && estBytes > 25 * 1024) return 'P1';
  if (!cacheControl || /max-age=0|no-cache|no-store/i.test(cacheControl)) return 'P2';
  return 'P3';
}

(async () => {
  const sitemapXml = await (await fetch(BASE + '/sitemap.xml')).text();
  const allLocs = parseLocs(sitemapXml);

  const enProductUrls = allLocs.filter((u) => /^https:\/\/www\.mildmate\.com\/product\/[^/]+\/$/.test(u));
  const thProductUrls = allLocs.filter((u) => /^https:\/\/www\.mildmate\.com\/th\/product\/[^/]+\/$/.test(u));
  const pageUrls = [...enProductUrls, ...thProductUrls].sort();

  const slugSet = new Set(pageUrls.map((u) => u.replace(/\/$/, '').split('/').pop()));
  const slugs = Array.from(slugSet).sort();

  const productApiBySlug = {};
  await mapLimit(slugs, 6, async (slug) => {
    try {
      const resp = await fetch(`${BASE}/api/products/${slug}`);
      const json = await resp.json();
      const p = json && (json.product || json);
      const galleryRaw = parseImagesField(p?.images);
      const gallery = galleryRaw.map((s) => normalizeAssetUrl(s, BASE)).filter(Boolean);
      const imageUrl = normalizeAssetUrl(p?.image_url || '', BASE);
      const galleryFinal = gallery.length ? gallery : (imageUrl ? [imageUrl] : []);
      productApiBySlug[slug] = {
        ok: true,
        image_url: imageUrl,
        gallery: Array.from(new Set(galleryFinal)),
      };
    } catch {
      productApiBySlug[slug] = { ok: false, gallery: [], image_url: null };
    }
  });

  const pageHtmlData = {};
  await mapLimit(pageUrls, 6, async (url) => {
    let status = null;
    let html = '';
    try {
      const resp = await fetch(url);
      status = resp.status;
      html = await resp.text();
    } catch {}

    const imgTags = html.match(/<img\b[^>]*>/gi) || [];
    const parsedImgs = imgTags.map((tag) => {
      const src = extractAttr(tag, 'src');
      const srcset = extractAttr(tag, 'srcset');
      const sizes = extractAttr(tag, 'sizes');
      const loading = extractAttr(tag, 'loading');
      const fetchpriority = extractAttr(tag, 'fetchpriority');
      const id = extractAttr(tag, 'id');
      const klass = extractAttr(tag, 'class');
      const alt = extractAttr(tag, 'alt');
      return {
        src,
        absSrc: normalizeAssetUrl(src, url),
        srcset,
        sizes,
        loading,
        fetchpriority,
        id,
        class: klass,
        alt,
      };
    });

    const productImgs = parsedImgs.filter((x) => isProductRelatedAsset(x.absSrc));
    const hero = parsedImgs.find((x) => x.id === 'gallery-main-img') || null;

    let template = 'fixed';
    if (/marine-shape-select|marine-mode-standard|MARINE_SHAPES_JS/i.test(html)) template = 'marine';
    else if (/id="tab-custom"|config-tabs|custom-dimensions/i.test(html)) template = 'customizable';

    pageHtmlData[url] = {
      status,
      html,
      template,
      productImgs,
      responsiveImgCount: parsedImgs.filter((x) => !!x.srcset || !!x.sizes).length,
      hero,
      hasThumbVariantCode: /\/thumbs\//i.test(html),
      thumbnailLikelyFullRes: /carousel-thumb[\s\S]*src="' \+ item \+ '"/i.test(html),
      hasPictureTag: /<picture[\s>]/i.test(html),
    };
  });

  const pageDisplay = {};
  const browser = await chromium.launch({ headless: true });
  const viewports = {
    mobile: { width: 390, height: 1900 },
    desktop: { width: 1366, height: 2200 },
  };

  for (const [vpName, vp] of Object.entries(viewports)) {
    const context = await browser.newContext({ viewport: vp });
    await context.route(/\.(?:png|jpe?g|webp|avif|gif|svg)(?:\?|$)/i, (route) => route.abort());

    for (const pageUrl of pageUrls) {
      const page = await context.newPage();
      const target = pageUrl + '?img_audit_cb=' + Date.now();
      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(900);

        for (const rx of [/accept all|ยอมรับทั้งหมด/i, /essential only|เฉพาะที่จำเป็น/i, /save preferences|บันทึกการตั้งค่า/i]) {
          try {
            const b = page.getByRole('button', { name: rx });
            if (await b.count()) { await b.first().click({ timeout: 700 }); break; }
          } catch {}
        }

        const rows = await page.evaluate(() => {
          function abs(src) {
            try { return new URL(src, location.href).href; } catch { return src || ''; }
          }
          function wanted(src) {
            return src && (
              src.includes('/images/products/') ||
              src.includes('r2.dev/products/') ||
              src.includes('/images/placeholder')
            );
          }
          function rec(el, role) {
            if (!el) return null;
            const srcRaw = el.getAttribute('src') || '';
            const src = abs(srcRaw);
            if (!wanted(src)) return null;
            const r = el.getBoundingClientRect();
            return { src, role, width: Math.round(r.width), height: Math.round(r.height) };
          }

          const out = [];
          const push = (v) => { if (v) out.push(v); };
          push(rec(document.querySelector('#gallery-main-img'), 'hero'));
          document.querySelectorAll('#carousel-track img').forEach((el) => push(rec(el, 'gallery-slide')));
          document.querySelectorAll('#carousel-thumbs img').forEach((el) => push(rec(el, 'gallery-thumb')));
          push(rec(document.querySelector('.dim-diagram img'), 'diagram'));
          document.querySelectorAll('.related-grid img').forEach((el) => push(rec(el, 'related')));
          return out;
        });

        if (!pageDisplay[pageUrl]) pageDisplay[pageUrl] = {};
        pageDisplay[pageUrl][vpName] = rows;
      } catch {
        if (!pageDisplay[pageUrl]) pageDisplay[pageUrl] = {};
        pageDisplay[pageUrl][vpName] = [];
      } finally {
        await page.close();
      }
    }

    await context.close();
  }
  await browser.close();

  const pageAssets = {};
  for (const url of pageUrls) {
    const slug = url.replace(/\/$/, '').split('/').pop();
    const htmlData = pageHtmlData[url] || { productImgs: [] };
    const api = productApiBySlug[slug] || { gallery: [] };

    const assets = new Set();
    for (const img of htmlData.productImgs || []) if (img.absSrc) assets.add(img.absSrc);
    for (const g of api.gallery || []) assets.add(g);
    const dMobile = (pageDisplay[url] && pageDisplay[url].mobile) || [];
    const dDesktop = (pageDisplay[url] && pageDisplay[url].desktop) || [];
    for (const d of [...dMobile, ...dDesktop]) if (d.src) assets.add(d.src);

    pageAssets[url] = {
      slug,
      lang: url.includes('/th/product/') ? 'TH' : 'EN',
      template: (pageHtmlData[url] || {}).template || 'unknown',
      assets: Array.from(assets),
      galleryCount: (api.gallery || []).length,
      htmlImageCount: (htmlData.productImgs || []).length,
      responsiveImgCount: htmlData.responsiveImgCount || 0,
      hasPictureTag: !!htmlData.hasPictureTag,
      hero: htmlData.hero || null,
      hasThumbVariantCode: !!htmlData.hasThumbVariantCode,
      thumbnailLikelyFullRes: !!htmlData.thumbnailLikelyFullRes,
      displayMobile: dMobile,
      displayDesktop: dDesktop,
      status: htmlData.status,
    };
  }

  const allAssets = Array.from(new Set(Object.values(pageAssets).flatMap((p) => p.assets))).sort();
  const assetMeta = {};

  await mapLimit(allAssets, 8, async (assetUrl) => {
    let contentType = '';
    let contentLength = null;
    let cacheControl = '';
    let etag = '';
    let lastModified = '';
    let status = null;
    let dimensions = null;

    try {
      const headResp = await fetch(assetUrl, { method: 'HEAD' });
      status = headResp.status;
      contentType = headResp.headers.get('content-type') || '';
      cacheControl = headResp.headers.get('cache-control') || '';
      etag = headResp.headers.get('etag') || '';
      lastModified = headResp.headers.get('last-modified') || '';
      const len = headResp.headers.get('content-length');
      if (len && /^\d+$/.test(len)) contentLength = Number(len);
    } catch {}

    const format = parseFormat(contentType, assetUrl);
    try {
      const rangeResp = await fetch(assetUrl, { headers: { Range: 'bytes=0-65535' } });
      if (!status) status = rangeResp.status;
      if (!contentType) contentType = rangeResp.headers.get('content-type') || '';
      if (!cacheControl) cacheControl = rangeResp.headers.get('cache-control') || '';
      if (!etag) etag = rangeResp.headers.get('etag') || '';
      if (!lastModified) lastModified = rangeResp.headers.get('last-modified') || '';
      const arr = new Uint8Array(await rangeResp.arrayBuffer());
      const buf = Buffer.from(arr);
      dimensions = parseDimensionsFromBytes(buf, format);
      if (contentLength == null) {
        const cr = rangeResp.headers.get('content-range') || '';
        const m = cr.match(/\/(\d+)$/);
        if (m) contentLength = Number(m[1]);
      }
    } catch {}

    assetMeta[assetUrl] = {
      status,
      contentType,
      format,
      bytes: contentLength,
      cacheControl,
      etag,
      lastModified,
      width: dimensions ? dimensions.width : null,
      height: dimensions ? dimensions.height : null,
    };
  });

  const assetUsage = {};
  for (const [pageUrl, p] of Object.entries(pageAssets)) {
    for (const a of p.assets) {
      if (!assetUsage[a]) {
        assetUsage[a] = {
          pages: new Set(),
          roles: new Set(),
          maxDisplayMobile: { width: 0, height: 0 },
          maxDisplayDesktop: { width: 0, height: 0 },
          usedAsHero: false,
        };
      }
      assetUsage[a].pages.add(pageUrl);
    }

    const addDisplay = (rows, mode) => {
      for (const r of rows) {
        if (!assetUsage[r.src]) continue;
        assetUsage[r.src].roles.add(r.role);
        const target = mode === 'mobile' ? assetUsage[r.src].maxDisplayMobile : assetUsage[r.src].maxDisplayDesktop;
        if ((r.width || 0) * (r.height || 0) > target.width * target.height) {
          target.width = r.width || 0;
          target.height = r.height || 0;
        }
        if (r.role === 'hero') assetUsage[r.src].usedAsHero = true;
      }
    };
    addDisplay(p.displayMobile || [], 'mobile');
    addDisplay(p.displayDesktop || [], 'desktop');
    if (p.hero && p.hero.absSrc && assetUsage[p.hero.absSrc]) {
      assetUsage[p.hero.absSrc].usedAsHero = true;
      assetUsage[p.hero.absSrc].roles.add('hero');
    }
  }

  function estimateSavings(meta, usage) {
    const bytes = meta.bytes || 0;
    const srcW = meta.width || 0;
    const srcH = meta.height || 0;
    const dispW = Math.max(usage.maxDisplayMobile.width || 0, usage.maxDisplayDesktop.width || 0);
    const dispH = Math.max(usage.maxDisplayMobile.height || 0, usage.maxDisplayDesktop.height || 0);
    const srcPx = srcW * srcH;
    const dispPx = dispW * dispH;

    let est = 0;
    const reasons = [];

    if (bytes > 0 && srcPx > 0 && dispPx > 0) {
      const ratio = srcPx / dispPx;
      if (ratio > 2.2 && bytes > 50 * 1024) {
        const factor = Math.min(0.75, Math.max(0.15, 1 - (1 / Math.sqrt(ratio))));
        est = Math.max(est, Math.round(bytes * factor));
        reasons.push(`oversized(${ratio.toFixed(1)}x pixels)`);
      }
    }
    if ((meta.format === 'png') && bytes > 80 * 1024) {
      est = Math.max(est, Math.round(bytes * 0.45));
      reasons.push('png-to-modern-format');
    }
    if (usage.roles.has('gallery-thumb') && bytes > 40 * 1024) {
      est = Math.max(est, Math.round(bytes * 0.6));
      reasons.push('thumb-uses-large-source');
    }

    return {
      estimatedSavingsBytes: est,
      reasons,
      priority: rolePriority(usage.roles, usage.usedAsHero, meta.cacheControl || '', est),
    };
  }

  const assetRows = [];
  for (const assetUrl of allAssets) {
    const meta = assetMeta[assetUrl] || {};
    const usage = assetUsage[assetUrl] || {
      pages: new Set(), roles: new Set(), maxDisplayMobile: { width: 0, height: 0 }, maxDisplayDesktop: { width: 0, height: 0 }, usedAsHero: false,
    };
    const est = estimateSavings(meta, usage);

    let action = 'Keep as is';
    if (est.reasons.includes('thumb-uses-large-source')) action = 'Generate dedicated thumbnail variants and stop full-res thumb loading';
    else if (est.reasons.includes('png-to-modern-format')) action = 'Convert to WebP/AVIF with visual QA fallback';
    else if (est.reasons.some((r) => r.startsWith('oversized('))) action = 'Generate right-sized responsive variants (hero + gallery)';

    assetRows.push({
      asset_url: assetUrl,
      format: meta.format || '',
      bytes: meta.bytes || '',
      width: meta.width || '',
      height: meta.height || '',
      display_mobile_width: usage.maxDisplayMobile.width || '',
      display_mobile_height: usage.maxDisplayMobile.height || '',
      display_desktop_width: usage.maxDisplayDesktop.width || '',
      display_desktop_height: usage.maxDisplayDesktop.height || '',
      pages_using_count: usage.pages.size,
      pages_using_sample: Array.from(usage.pages).slice(0, 6).join(' | '),
      roles: Array.from(usage.roles).sort().join('|'),
      cache_control: meta.cacheControl || '',
      content_type: meta.contentType || '',
      etag_present: meta.etag ? 'yes' : 'no',
      last_modified_present: meta.lastModified ? 'yes' : 'no',
      estimated_savings_kb: est.estimatedSavingsBytes ? (est.estimatedSavingsBytes / 1024).toFixed(1) : '0.0',
      issue_flags: est.reasons.join('|'),
      priority: est.priority,
      recommended_action: action,
    });
  }

  const assetByUrl = Object.fromEntries(assetRows.map((r) => [r.asset_url, r]));
  const productRows = [];
  const priOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };

  for (const pageUrl of pageUrls) {
    const p = pageAssets[pageUrl];
    let totalBytes = 0;
    let estSavings = 0;
    let maxPriority = 'P3';

    for (const a of p.assets) {
      const row = assetByUrl[a];
      if (!row) continue;
      const b = Number(row.bytes || 0);
      const s = Number(row.estimated_savings_kb || 0) * 1024;
      totalBytes += b;
      estSavings += s;
      if (priOrder[row.priority] < priOrder[maxPriority]) maxPriority = row.priority;
    }

    productRows.push({
      product: p.slug,
      page_url: pageUrl,
      en_th: p.lang,
      template_family: p.template,
      gallery_images: p.galleryCount,
      unique_image_assets: p.assets.length,
      total_image_weight_kb: (totalBytes / 1024).toFixed(1),
      estimated_savings_kb: (estSavings / 1024).toFixed(1),
      priority: maxPriority,
      hero_loading: p.hero ? (p.hero.loading || '(unset)') : '(missing)',
      hero_fetchpriority: p.hero ? (p.hero.fetchpriority || '(unset)') : '(missing)',
      responsive_img_tags: p.responsiveImgCount,
      has_picture_tag: p.hasPictureTag ? 'yes' : 'no',
      thumbnail_loading_strategy: p.hasThumbVariantCode ? 'variant-detected' : (p.thumbnailLikelyFullRes ? 'likely-fullres-thumbs' : 'unknown'),
      http_status: p.status,
    });
  }

  productRows.sort((a, b) => a.page_url.localeCompare(b.page_url));
  assetRows.sort((a, b) => {
    if (priOrder[a.priority] !== priOrder[b.priority]) return priOrder[a.priority] - priOrder[b.priority];
    return Number(b.estimated_savings_kb) - Number(a.estimated_savings_kb);
  });

  fs.writeFileSync(PRODUCT_CSV, toCsv(productRows, [
    'product','page_url','en_th','template_family','gallery_images','unique_image_assets','total_image_weight_kb','estimated_savings_kb','priority','hero_loading','hero_fetchpriority','responsive_img_tags','has_picture_tag','thumbnail_loading_strategy','http_status'
  ]), 'utf8');

  fs.writeFileSync(ASSET_CSV, toCsv(assetRows, [
    'asset_url','format','bytes','width','height','display_mobile_width','display_mobile_height','display_desktop_width','display_desktop_height','pages_using_count','pages_using_sample','roles','cache_control','content_type','etag_present','last_modified_present','estimated_savings_kb','issue_flags','priority','recommended_action'
  ]), 'utf8');

  const summary = {
    generated_at: new Date().toISOString(),
    sitemap_product_urls: { en: enProductUrls.length, th: thProductUrls.length, total: pageUrls.length },
    slug_count: slugs.length,
    unique_assets: assetRows.length,
    oversized_assets: assetRows.filter((r) => String(r.issue_flags || '').includes('oversized(')).length,
    thumbnail_large_source_assets: assetRows.filter((r) => String(r.issue_flags || '').includes('thumb-uses-large-source')).length,
    png_inefficient_assets: assetRows.filter((r) => String(r.issue_flags || '').includes('png-to-modern-format')).length,
    no_responsive_support_pages: productRows.filter((r) => Number(r.responsive_img_tags || 0) === 0 && r.has_picture_tag === 'no').length,
    likely_fullres_thumb_pages: productRows.filter((r) => r.thumbnail_loading_strategy === 'likely-fullres-thumbs').length,
    estimated_savings_distinct_kb: Number((assetRows.reduce((sum, r) => sum + Number(r.estimated_savings_kb || 0), 0)).toFixed(1)),
    top_assets_by_savings: assetRows.slice(0, 20),
    top_pages_by_savings: [...productRows].sort((a, b) => Number(b.estimated_savings_kb) - Number(a.estimated_savings_kb)).slice(0, 20),
    product_rows: productRows,
    asset_rows: assetRows,
  };

  fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2), 'utf8');
  console.log('WROTE', PRODUCT_CSV);
  console.log('WROTE', ASSET_CSV);
  console.log('WROTE', SUMMARY_JSON);
  console.log('COUNTS', JSON.stringify({ totalPages: pageUrls.length, en: enProductUrls.length, th: thProductUrls.length, slugs: slugs.length, uniqueAssets: assetRows.length }, null, 2));
})();
