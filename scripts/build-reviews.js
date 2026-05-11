/**
 * MildMate Review Builder
 * Maps data/reviews.json (Etsy reviews) to order CSVs for real names/countries,
 * then injects formatted cards into public/index.html and public/reviews/index.html.
 *
 * Usage: node scripts/build-reviews.js
 * Then:  npx wrangler pages deploy public --commit-dirty=true
 */

const fs = require('fs');
const path = require('path');

const REVIEWS_JSON = path.join(__dirname, '..', 'data', 'reviews.json');
const ORDERS_2025 = path.join(__dirname, '..', 'data', 'EtsySoldOrders2025.csv');
const ORDERS_2026 = path.join(__dirname, '..', 'data', 'EtsySoldOrders2026.csv');
const HOMEPAGE = path.join(__dirname, '..', 'public', 'index.html');
const REVIEWS_PAGE = path.join(__dirname, '..', 'public', 'reviews', 'index.html');

/* Order IDs to feature on the homepage carousel (5 max) */
const FEATURED_ORDER_IDS = [
  '4016607099', // SimpliciteeNYC / Clayton Jones — emotional, health-focused
  '4021138290', // White Wall / William Sam — detailed technical
  '3826057194', // Tariq / Tariq Bacchus — concise quality
  '3746581690', // John / John Van Coller — duvet product love
  '3911090197', // Gummels / Frank Koden — international (German)
];

/* ── CSV parser (handles quoted fields) ────────────────── */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);

  return fields.map((f) => {
    f = f.trim();
    if (f.startsWith('"') && f.endsWith('"')) f = f.slice(1, -1);
    return f.replace(/""/g, '"');
  });
}

function loadOrderMap(csvPath) {
  const map = new Map();
  if (!fs.existsSync(csvPath)) {
    console.warn(`  CSV not found: ${csvPath}`);
    return map;
  }

  const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
  if (!lines.length) return map;

  const headers = parseCSVLine(lines[0]);
  const orderIdx = headers.findIndex((h) =>
    h.toLowerCase().includes('order id')
  );
  const firstNameIdx = headers.findIndex((h) =>
    h.toLowerCase().includes('first name')
  );
  const countryIdx = headers.findIndex((h) =>
    h.toLowerCase().includes('ship country')
  );

  if (orderIdx === -1 || firstNameIdx === -1 || countryIdx === -1) {
    console.warn(`  Could not find required columns in ${csvPath}`);
    return map;
  }

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length <= Math.max(orderIdx, firstNameIdx, countryIdx))
      continue;

    const orderId = fields[orderIdx]?.trim();
    const firstName = fields[firstNameIdx]?.trim();
    const country = fields[countryIdx]?.trim();

    if (orderId && !map.has(orderId)) {
      map.set(orderId, { firstName, country });
    }
  }

  return map;
}

/* ── Text helpers ─────────────────────────────────────── */
function cleanText(text) {
  return text.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderStars(count) {
  return '&#9733;'.repeat(count);
}

function renderReviewCard(review) {
  const countryPart = review.country ? `, ${review.country}` : '';
  return `          <div class="review-card">
            <div class="review-stars">${renderStars(review.stars)}</div>
            <p class="review-text">&ldquo;${review.text}&rdquo;</p>
            <div class="review-author">&mdash; ${review.author}${countryPart}</div>
          </div>`;
}

function updateBetweenMarkers(filePath, startMarker, endMarker, newContent) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1) {
    console.error(`ERROR: Markers not found in ${path.basename(filePath)}`);
    console.error(`  Start: ${startMarker}`);
    console.error(`  End:   ${endMarker}`);
    return false;
  }

  const before = content.substring(0, startIdx + startMarker.length);
  const after = content.substring(endIdx);
  fs.writeFileSync(filePath, before + '\n' + newContent + '\n' + after, 'utf-8');
  console.log(`Updated: ${path.relative(process.cwd(), filePath)}`);
  return true;
}

/* ── Main ───────────────────────────────────────────────── */
function main() {
  /* 1. Load data */
  if (!fs.existsSync(REVIEWS_JSON)) {
    console.error(`ERROR: ${REVIEWS_JSON} not found.`);
    process.exit(1);
  }

  const rawReviews = JSON.parse(fs.readFileSync(REVIEWS_JSON, 'utf-8'));
  console.log(`Loaded ${rawReviews.length} reviews from JSON.`);

  const orderMap2025 = loadOrderMap(ORDERS_2025);
  const orderMap2026 = loadOrderMap(ORDERS_2026);
  const orderMap = new Map([...orderMap2025, ...orderMap2026]);
  console.log(`Loaded ${orderMap.size} unique orders from CSVs.`);

  /* 2. Map & clean reviews */
  const mappedReviews = rawReviews.map((r) => {
    const orderId = String(r.order_id);
    const mapped = orderMap.get(orderId);

    return {
      text: cleanText(r.message),
      author: mapped?.firstName || r.reviewer || 'Anonymous',
      country: mapped?.country || '',
      stars: r.star_rating || 5,
      orderId,
      rawReviewer: r.reviewer,
    };
  });

  /* Log mapping results */
  let matched = 0,
    unmatched = 0;
  mappedReviews.forEach((r) => {
    if (r.country) matched++;
    else unmatched++;
  });
  console.log(`  Matched to orders: ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);

  /* Save mapped data for reference */
  const mappedJsonPath = path.join(__dirname, '..', 'data', 'reviews-mapped.json');
  fs.writeFileSync(mappedJsonPath, JSON.stringify(mappedReviews, null, 2), 'utf-8');
  console.log(`Saved mapped data to ${path.relative(process.cwd(), mappedJsonPath)}`);

  /* 3. Build homepage carousel (featured reviews) */
  const featured = [];
  for (const oid of FEATURED_ORDER_IDS) {
    const rev = mappedReviews.find((r) => r.orderId === oid);
    if (rev) {
      featured.push(rev);
    } else {
      console.warn(`  WARNING: Featured order ${oid} not found in reviews.`);
    }
  }

  if (featured.length === 0) {
    console.error('ERROR: No featured reviews found. Nothing to inject.');
    process.exit(1);
  }

  console.log(`\nHomepage carousel: ${featured.length} featured reviews`);

  /* Generate cards */
  const homepageCards = featured.map(renderReviewCard).join('\n');

  /* Generate dots (3 dots for 5 cards at 2-per-page) */
  const dotCount = Math.ceil(featured.length / 2);
  const homepageDots = Array.from({ length: dotCount }, (_, i) => {
    const activeClass = i === 0 ? ' active' : '';
    return `            <button class="reviews-dot${activeClass}" data-index="${i}" aria-label="Reviews page ${i + 1}"></button>`;
  }).join('\n');

  /* 4. Build reviews page (all reviews) */
  const allCards = mappedReviews.map(renderReviewCard).join('\n');

  /* 5. Inject into HTML files */
  const ok1 = updateBetweenMarkers(
    HOMEPAGE,
    '<!-- REVIEWS-START -->',
    '<!-- REVIEWS-END -->',
    homepageCards
  );
  const ok2 = updateBetweenMarkers(
    HOMEPAGE,
    '<!-- DOTS-START -->',
    '<!-- DOTS-END -->',
    homepageDots
  );
  const ok3 = updateBetweenMarkers(
    REVIEWS_PAGE,
    '<!-- REVIEWS-START -->',
    '<!-- REVIEWS-END -->',
    allCards
  );

  if (!ok1 || !ok2 || !ok3) {
    console.error('\nSome files failed to update. Check marker comments exist.');
    process.exit(1);
  }

  console.log('\nDone! Next step:');
  console.log('  npx wrangler pages deploy public --commit-dirty=true');
}

main();
