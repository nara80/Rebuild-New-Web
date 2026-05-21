// build-blogs.js — Centralized blog post builder
// Reads blog-posts.json + products.json, applies blog-post.html template, writes blog pages
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TEMPLATES_DIR = path.join(ROOT, 'templates');
const PUBLIC_DIR = path.join(ROOT, 'public', 'blogs');

// ── Load Data ──────────────────────────────────────────
const blogData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'blog-posts.json'), 'utf8'));
const productsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'products.json'), 'utf8'));

// Build a slug→product map for quick lookup
const productMap = {};
for (const p of productsData.products) {
  productMap[p.slug] = p;
}

// ── Load Template ─────────────────────────────────────
const template = fs.readFileSync(path.join(TEMPLATES_DIR, 'blog-post.html'), 'utf8');

// ── Helpers ───────────────────────────────────────────

/**
 * Build an individual related product card HTML.
 * Looks up product URL from products.json by slug.
 */
function buildRelatedCard(rp) {
  // Look up product URL from products.json
  const product = productMap[rp.slug];
  const productUrl = product ? product.url : `/product/${rp.slug}/`;

  // Build tags HTML
  const tagsHtml = rp.tags
    .map(tag => `<span class="card-tag">${escapeHtml(tag)}</span>`)
    .join('');

  return `          <article class="related-card">
            <div class="card-image">
              <img src="${escapeHtml(rp.image)}" alt="${escapeHtml(rp.alt)}" width="800" height="600" loading="lazy" decoding="async">
            </div>
            <div class="card-body">
              <div class="card-tags">${tagsHtml}</div>
              <h3 class="card-title">${escapeHtml(rp.title)}</h3>
              <div class="card-price">${escapeHtml(rp.price)}</div>
              <div class="card-price-note">Excludes shipping, tax &amp; tariff</div>
              <a href="${escapeHtml(productUrl)}" class="btn btn-primary">View Options</a>
            </div>
          </article>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Build Posts ───────────────────────────────────────
let count = 0;

for (const [key, post] of Object.entries(blogData.posts)) {
  console.log(`[${++count}] Building: ${post.slug}`);

  // Build related products HTML
  const relatedCardsHtml = (post.relatedProducts || [])
    .map(rp => buildRelatedCard(rp))
    .join('\n');

  // Build the output by replacing placeholders
  let output = template;

  // Simple string replacements
  const replacements = {
    '{{META_DESCRIPTION}}': post.metaDescription || '',
    '{{TITLE}}': post.title || '',
    '{{HERO_IMAGE}}': post.heroImage || '',
    '{{HERO_IMAGE_ALT}}': post.heroImageAlt || '',
    '{{CATEGORY}}': post.category || '',
    '{{DATE}}': post.date || '',
    '{{AUTHOR}}': post.author || '',
    '{{READ_TIME}}': post.readTime || '',
    '{{TH_REDIRECT_PATH}}': post.thRedirectPath || '',
    '{{BLOG_BODY}}': post.blogBodyHtml || '',
    '{{CTA_HTML}}': post.ctaHtml || '',
    '{{AUTHOR_AVATAR}}': post.authorAvatar || '',
    '{{AUTHOR_BIO}}': post.authorBio || '',
    '{{RELATED_PRODUCTS}}': relatedCardsHtml
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    output = output.split(placeholder).join(value);
  }

  // Ensure output directory exists
  const outDir = path.join(PUBLIC_DIR, post.slug);
  fs.mkdirSync(outDir, { recursive: true });

  // Write output file
  const outPath = path.join(outDir, 'index.html');
  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`  → Wrote ${outPath}`);
}

console.log(`\nDone. ${count} blog post(s) built.`);
