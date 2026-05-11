/**
 * MildMate Review Update Script
 * Reads data/reviews.csv and injects reviews into:
 *   - public/index.html (homepage: first 2 'featured=yes' reviews)
 *   - public/reviews/index.html (reviews page: all reviews)
 *
 * Usage: node scripts/update-reviews.js
 * Then deploy manually when ready.
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'reviews.csv');
const HOMEPAGE_PATH = path.join(__dirname, '..', 'public', 'index.html');
const REVIEWS_PAGE_PATH = path.join(__dirname, '..', 'public', 'reviews', 'index.html');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').trim();
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());

  const reviews = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields that may contain commas
    const row = {};
    const matches = line.match(/^"([^"]*)"|(.*)$/);
    let remaining = line;

    // Simple CSV parser: first field is text (quoted), rest are unquoted
    let text = '';
    if (remaining.startsWith('"')) {
      const endQuote = remaining.indexOf('"', 1);
      text = remaining.substring(1, endQuote);
      remaining = remaining.substring(endQuote + 2); // skip ",
    }

    const otherFields = remaining.split(',');
    row.text = text;
    row.author = otherFields[0] || '';
    row.country = otherFields[1] || '';
    row.stars = parseInt(otherFields[2], 10) || 5;
    row.featured = (otherFields[3] || '').trim().toLowerCase() === 'yes';

    reviews.push(row);
  }

  return reviews;
}

function renderStars(count) {
  return '&#9733;'.repeat(count);
}

function renderReviewCard(review) {
  return `          <div class="review-card">
            <div class="review-stars">${renderStars(review.stars)}</div>
            <p class="review-text">&ldquo;${review.text}&rdquo;</p>
            <div class="review-author">&mdash; ${review.author}, ${review.country}</div>
          </div>`;
}

function updateFile(filePath, markerStart, markerEnd, newContent) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const startIdx = content.indexOf(markerStart);
  const endIdx = content.indexOf(markerEnd);

  if (startIdx === -1 || endIdx === -1) {
    console.error(`ERROR: Markers not found in ${filePath}`);
    console.error(`  Looking for: ${markerStart}`);
    console.error(`  And: ${markerEnd}`);
    process.exit(1);
  }

  const before = content.substring(0, startIdx + markerStart.length);
  const after = content.substring(endIdx);
  const updated = before + '\n' + newContent + '\n' + after;

  fs.writeFileSync(filePath, updated, 'utf-8');
  console.log(`Updated: ${path.relative(process.cwd(), filePath)}`);
}

function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: ${CSV_PATH} not found.`);
    console.error('Place your reviews CSV there and run again.');
    process.exit(1);
  }

  const reviews = parseCSV(CSV_PATH);
  console.log(`Loaded ${reviews.length} reviews from CSV.`);

  const featured = reviews.filter(r => r.featured);
  console.log(`  Featured (homepage): ${featured.length}`);
  console.log(`  Total (reviews page): ${reviews.length}`);

  // --- Update Homepage: first 2 featured reviews ---
  const homepageReviews = featured.slice(0, 2);
  if (homepageReviews.length === 0) {
    console.warn('WARNING: No featured reviews found. Homepage will use first 2 from CSV.');
    homepageReviews.push(...reviews.slice(0, 2));
  }
  const homepageCards = homepageReviews.map(renderReviewCard).join('\n');
  updateFile(
    HOMEPAGE_PATH,
    '<!-- REVIEWS-START -->',
    '<!-- REVIEWS-END -->',
    homepageCards
  );

  // --- Update Reviews Page: all reviews ---
  const allCards = reviews.map(renderReviewCard).join('\n');
  updateFile(
    REVIEWS_PAGE_PATH,
    '<!-- REVIEWS-START -->',
    '<!-- REVIEWS-END -->',
    allCards
  );

  console.log('\nDone! Deploy manually when ready.');
}

main();
