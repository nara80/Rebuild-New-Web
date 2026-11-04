const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|avif)$/i;
const VARIANT_PROFILES = [
  { id: 'thumb', dir: 'thumbs', suffix: '', width: 180, quality: 70 },
  { id: 'slide-640', dir: 'slides', suffix: '-640', width: 640, quality: 76 },
  { id: 'slide-960', dir: 'slides', suffix: '-960', width: 960, quality: 80 },
  { id: 'related-480', dir: 'related', suffix: '-480', width: 480, quality: 74 }
];

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(current);
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const item = {};
    headers.forEach((h, idx) => {
      item[h] = (cells[idx] || '').trim();
    });
    return item;
  });
}

function variantKeyFromPathname(pathname) {
  const normalized = String(pathname || '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^\/+/, '');
  if (!normalized) return '';
  return normalized
    .replace(/[^a-z0-9/_-]+/gi, '_')
    .replace(/\//g, '__')
    .toLowerCase();
}

function isImagePath(pathname) {
  return IMAGE_EXT_RE.test(String(pathname || ''));
}

function normalizeAssetRef(rootDir, ref) {
  if (!ref || typeof ref !== 'string') return null;
  let pathname = '';
  let sourceRef = ref.trim();
  if (!sourceRef) return null;
  if (/^https?:\/\//i.test(sourceRef)) {
    try {
      const parsed = new URL(sourceRef);
      pathname = parsed.pathname || '';
    } catch (_err) {
      return null;
    }
  } else if (sourceRef.startsWith('/')) {
    pathname = sourceRef;
  } else {
    return null;
  }
  if (!isImagePath(pathname)) return null;
  const localPath = path.join(rootDir, 'public', pathname.replace(/^\/+/, ''));
  const hasLocal = fs.existsSync(localPath);
  return {
    sourceRef,
    pathname,
    sourceKey: pathname.toLowerCase(),
    inputRef: hasLocal ? localPath : sourceRef,
    localPath: hasLocal ? localPath : null
  };
}

function ffmpegAvailable() {
  const probe = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  return probe.status === 0;
}

function renderWebp(inputRef, outputPath, width, quality, force) {
  if (!force && fs.existsSync(outputPath)) {
    const existingBytes = fs.statSync(outputPath).size;
    if (existingBytes > 0) return { status: 'existing', bytes: existingBytes };
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const vf = `scale=w='if(gt(iw,${width}),${width},iw)':h=-2:flags=lanczos`;
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    inputRef,
    '-vf',
    vf,
    '-frames:v',
    '1',
    '-c:v',
    'libwebp',
    '-quality',
    String(quality),
    '-compression_level',
    '6',
    '-preset',
    'picture',
    outputPath
  ];
  const run = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (run.status !== 0) {
    return {
      status: 'error',
      error: (run.stderr || run.stdout || 'ffmpeg failed').trim().slice(0, 800)
    };
  }
  const bytes = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0;
  return { status: 'generated', bytes };
}

function parseJsonFile(filePath, fallbackValue) {
  if (!fs.existsSync(filePath)) return fallbackValue;
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
    return JSON.parse(content);
  } catch (_err) {
    return fallbackValue;
  }
}

function extractProductImageRefs(productsData) {
  const refs = [];
  const products = (productsData && productsData.products) || [];
  products.forEach((prod) => {
    if (prod && typeof prod.image === 'string') refs.push(prod.image);
    const imagesField = prod && prod.images;
    if (Array.isArray(imagesField)) {
      imagesField.forEach((img) => refs.push(img));
      return;
    }
    if (typeof imagesField === 'string' && imagesField.trim()) {
      try {
        const parsed = JSON.parse(imagesField);
        if (Array.isArray(parsed)) parsed.forEach((img) => refs.push(img));
      } catch (_err) {
        // ignore malformed strings
      }
    }
  });
  return refs;
}

function parseImagesField(imagesField) {
  if (!imagesField) return [];
  if (Array.isArray(imagesField)) return imagesField.filter(Boolean);
  if (typeof imagesField !== 'string') return [];
  const text = imagesField.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch (_err) {
    try {
      const repaired = text.replace(/\\"/g, '"');
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_err2) {
      return [];
    }
  }
  return [];
}

function fetchApiImageRefs(apiBaseUrl, slugs, quiet) {
  const refs = [];
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');
  if (!base) return refs;
  slugs.forEach((slug, index) => {
    const endpoint = `${base}/api/products/${slug}`;
    const run = spawnSync('curl.exe', ['-fsSL', endpoint], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (run.status !== 0 || !run.stdout) {
      if (!quiet) console.warn(`[image-variant-pipeline] api fetch failed for ${slug}`);
      return;
    }
    try {
      const payload = JSON.parse(run.stdout);
      const product = payload && (payload.product || payload);
      if (!product) return;
      refs.push(product.image_url || product.image || '');
      parseImagesField(product.images).forEach((img) => refs.push(img));
      if (!quiet && ((index + 1) % 10 === 0 || index === slugs.length - 1)) {
        console.log(`[image-variant-pipeline] fetched API images ${index + 1}/${slugs.length}`);
      }
    } catch (_err) {
      if (!quiet) console.warn(`[image-variant-pipeline] invalid api payload for ${slug}`);
    }
  });
  return refs;
}

function ensureCommonDiagramWebp(rootDir, force) {
  const commonDir = path.join(rootDir, 'public', 'images', 'products', 'common');
  const jobs = [
    { source: path.join(commonDir, 'Duvet.png'), target: path.join(commonDir, 'Duvet.webp'), width: 1280, quality: 88 },
    { source: path.join(commonDir, 'Pillowcase.png'), target: path.join(commonDir, 'Pillowcase.webp'), width: 1280, quality: 88 },
    { source: path.join(commonDir, 'measure-VBerth-diagram.png'), target: path.join(commonDir, 'measure-VBerth-diagram.webp'), width: 1280, quality: 88 }
  ];
  const results = [];
  jobs.forEach((job) => {
    if (!fs.existsSync(job.source)) {
      results.push({ source: job.source, target: job.target, status: 'missing-source' });
      return;
    }
    const run = renderWebp(job.source, job.target, job.width, job.quality, force);
    results.push({ source: job.source, target: job.target, status: run.status, bytes: run.bytes || 0, error: run.error || '' });
  });
  return results;
}

// Content-derived version token: changes whenever any variant file's bytes change,
// so pages can cache-bust `?v=` variant URLs without per-asset hashes.
function computeVariantVersion(variantsRoot) {
  const hash = crypto.createHash('sha1');
  ['thumbs', 'slides', 'related'].forEach((dirName) => {
    const dirPath = path.join(variantsRoot, dirName);
    if (!fs.existsSync(dirPath)) return;
    fs.readdirSync(dirPath).sort().forEach((fileName) => {
      if (!/\.webp$/i.test(fileName)) return;
      const filePath = path.join(dirPath, fileName);
      try {
        const fileHash = crypto.createHash('sha1').update(fs.readFileSync(filePath)).digest('hex');
        hash.update(`${dirName}/${fileName}:${fileHash}\n`);
      } catch (_err) {
        hash.update(`${dirName}/${fileName}:unreadable\n`);
      }
    });
  });
  return hash.digest('hex').slice(0, 10);
}

function ensureCatalogImageVariants(options = {}) {
  const rootDir = options.rootDir || path.join(__dirname, '..');
  const force = !!options.force;
  const quiet = !!options.quiet;
  const variantsRoot = path.join(rootDir, 'public', 'images', 'products', 'variants');
  const manifestPath = options.manifestPath || path.join(variantsRoot, 'manifest.json');
  const productsPath = options.productsPath || path.join(rootDir, 'data', 'products.json');
  const auditCsvPath = options.auditCsvPath || path.join(rootDir, '00_Issue', 'product-image-performance-audit-20261103', 'IMAGE_ASSET_INVENTORY.csv');
  const envApiBaseUrls = String(process.env.MM_VARIANT_API_BASES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaultApiBaseUrls = ['https://www.mildmate.com', 'https://mildmate-new.pages.dev'];
  const optionApiBaseUrls = Array.isArray(options.apiBaseUrls) ? options.apiBaseUrls.filter(Boolean) : [];
  const apiBaseUrls = Array.from(new Set([...(optionApiBaseUrls.length ? optionApiBaseUrls : defaultApiBaseUrls), ...envApiBaseUrls]));

  if (!ffmpegAvailable()) {
    throw new Error('ffmpeg is required for image variant generation but is not available in PATH.');
  }

  const productsData = parseJsonFile(productsPath, { products: [] });
  const auditRows = fs.existsSync(auditCsvPath) ? parseCsv(fs.readFileSync(auditCsvPath, 'utf8')) : [];
  const allRefs = new Map();

  function addRef(ref, meta = {}) {
    const normalized = normalizeAssetRef(rootDir, ref);
    if (!normalized) return;
    const existing = allRefs.get(normalized.sourceKey);
    if (!existing) {
      allRefs.set(normalized.sourceKey, {
        sourceRef: normalized.sourceRef,
        pathname: normalized.pathname,
        inputRef: normalized.inputRef,
        localPath: normalized.localPath,
        roles: new Set(),
        priorities: new Set(),
        flags: new Set(),
        formats: new Set(),
        pagesUsingCount: 0
      });
    }
    const record = allRefs.get(normalized.sourceKey);
    if (meta.roles) String(meta.roles).split('|').map((r) => r.trim()).filter(Boolean).forEach((r) => record.roles.add(r));
    if (meta.priority) record.priorities.add(meta.priority);
    if (meta.issueFlags) String(meta.issueFlags).split('|').map((f) => f.trim()).filter(Boolean).forEach((f) => record.flags.add(f));
    if (meta.format) record.formats.add(meta.format.toLowerCase());
    if (meta.pagesUsingCount) {
      const count = Number(meta.pagesUsingCount);
      if (Number.isFinite(count) && count > record.pagesUsingCount) record.pagesUsingCount = count;
    }
  }

  extractProductImageRefs(productsData).forEach((ref) => addRef(ref));
  const productSlugs = ((productsData && productsData.products) || []).map((p) => p && p.slug).filter(Boolean);
  apiBaseUrls.forEach((apiBaseUrl) => {
    fetchApiImageRefs(apiBaseUrl, productSlugs, quiet).forEach((ref) => addRef(ref, { roles: 'gallery-slide|gallery-thumb|hero' }));
  });
  auditRows.forEach((row) => addRef(row.asset_url, {
    roles: row.roles,
    priority: row.priority,
    issueFlags: row.issue_flags,
    format: row.format,
    pagesUsingCount: row.pages_using_count
  }));

  [
    '/images/products/common/Duvet.png',
    '/images/products/common/Pillowcase.png',
    '/images/products/common/measure-VBerth-diagram.png',
    '/images/products/common/measure-mattress-diagram-01.png',
    '/images/products/common/measure-cushion-diagram-01.png'
  ].forEach((ref) => addRef(ref, { roles: 'diagram' }));

  const records = Array.from(allRefs.values()).sort((a, b) => a.pathname.localeCompare(b.pathname));
  let generatedCount = 0;
  let existingCount = 0;
  let errorCount = 0;
  const manifestEntries = [];

  records.forEach((record, index) => {
    const key = variantKeyFromPathname(record.pathname);
    if (!key) return;
    const isDiagram = record.pathname.includes('/common/') || record.roles.has('diagram');
    const profileResults = {};
    VARIANT_PROFILES.forEach((profile) => {
      const outFileName = `${key}${profile.suffix}.webp`;
      const outputPath = path.join(variantsRoot, profile.dir, outFileName);
      const quality = isDiagram ? Math.max(profile.quality, 84) : profile.quality;
      const run = renderWebp(record.inputRef, outputPath, profile.width, quality, force);
      if (run.status === 'generated') generatedCount++;
      else if (run.status === 'existing') existingCount++;
      else errorCount++;
      profileResults[profile.id] = {
        path: `/images/products/variants/${profile.dir}/${outFileName}`,
        bytes: run.bytes || 0,
        status: run.status,
        error: run.error || ''
      };
    });
    manifestEntries.push({
      source_url: record.sourceRef,
      pathname: record.pathname,
      variant_key: key,
      roles: Array.from(record.roles).sort(),
      priorities: Array.from(record.priorities).sort(),
      issue_flags: Array.from(record.flags).sort(),
      formats: Array.from(record.formats).sort(),
      pages_using_count: record.pagesUsingCount,
      variants: profileResults
    });
    if (!quiet && ((index + 1) % 50 === 0 || index === records.length - 1)) {
      console.log(`[image-variant-pipeline] processed ${index + 1}/${records.length}`);
    }
  });

  const diagramResults = ensureCommonDiagramWebp(rootDir, force);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  const variantVersion = computeVariantVersion(variantsRoot);
  const manifest = {
    generated_at: new Date().toISOString(),
    variant_version: variantVersion,
    source_count: records.length,
    variant_profiles: VARIANT_PROFILES,
    summary: {
      generated: generatedCount,
      existing: existingCount,
      errors: errorCount
    },
    common_diagram_conversions: diagramResults,
    entries: manifestEntries
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  if (!quiet) {
    console.log(`[image-variant-pipeline] source assets: ${records.length}`);
    console.log(`[image-variant-pipeline] variants generated: ${generatedCount}, existing: ${existingCount}, errors: ${errorCount}`);
    console.log(`[image-variant-pipeline] manifest written: ${manifestPath}`);
    console.log(`[image-variant-pipeline] variant version: ${variantVersion}`);
  }
  return manifest;
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  try {
    ensureCatalogImageVariants({ force });
  } catch (err) {
    console.error('[image-variant-pipeline] fatal:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

module.exports = {
  ensureCatalogImageVariants
};
