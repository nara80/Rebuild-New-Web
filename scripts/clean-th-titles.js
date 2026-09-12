#!/usr/bin/env node
// One-time cleanup script for data/products.json nameTh fields.
//
// Strategy: fetch clean Thai titles from D1 via the live /api/products endpoint
// (which reads from D1 `title_th` column). D1 was hand-curated with proper Thai
// text, while data/products.json was double-mojibake through ISO-8859-1/UTF-8
// round-trips. This script replaces nameTh in the local JSON with D1's clean
// values where D1 has them.
//
// Behavior:
//   - For each product in data/products.json:
//     - If nameTh is already clean Thai (U+0E00-U+0E7F, no Latin-1 markers), leave it
//     - If nameTh is mojibake, look up clean Thai from D1; replace if found
//     - If D1 also has mojibake or is missing, leave the local value alone
//   - Backup data/products.json → data/products.json.bak (skip if exists)
//   - Write cleaned JSON back
//   - Write a per-slug report to data/products-th-cleanup-report.json

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_PATH = path.join(__dirname, '..', 'data', 'products.json');
const BACKUP_PATH = DATA_PATH + '.bak';
const REPORT_PATH = path.join(__dirname, '..', 'data', 'products-th-cleanup-report.json');

const API_URL = 'https://www.mildmate.com/api/products';

const THAI_PATTERN = /[\u0e00-\u0e7f]/;
const MOJIBAKE_PATTERN = /[\u00c2\u00c3\u00c4\u00c5\u00e2\u20ac]/;

function isCleanThai(raw) {
  if (!raw) return false;
  if (MOJIBAKE_PATTERN.test(raw)) return false;
  return THAI_PATTERN.test(raw);
}

function fetchD1Titles() {
  return new Promise((resolve, reject) => {
    https.get(API_URL, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          const map = {};
          for (const p of data.products || []) {
            map[p.slug] = {
              titleTh: p.title_th || '',
              titleEn: p.title_en || ''
            };
          }
          resolve(map);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching D1 titles from ' + API_URL + '...');
  const d1Map = await fetchD1Titles();
  const d1Slugs = Object.keys(d1Map);
  console.log('Got ' + d1Slugs.length + ' products from D1');

  const rawBytes = fs.readFileSync(DATA_PATH);
  const data = JSON.parse(rawBytes.toString('utf8'));

  const report = {
    totalProducts: data.products.length,
    d1Matched: [],
    alreadyClean: [],
    replacedFromD1: [],
    notInD1: [],
    d1Mojibake: []
  };

  let changedCount = 0;

  for (const prod of data.products) {
    const slug = prod.slug;
    const localNameTh = prod.nameTh;
    const d1 = d1Map[slug];

    if (!d1) {
      report.notInD1.push(slug);
      continue;
    }

    report.d1Matched.push(slug);

    if (isCleanThai(localNameTh)) {
      report.alreadyClean.push({ slug, nameTh: localNameTh });
      continue;
    }

    // Local is mojibake (or missing). Try D1.
    const d1TitleTh = d1.titleTh;
    if (isCleanThai(d1TitleTh)) {
      prod.nameTh = d1TitleTh;
      report.replacedFromD1.push({
        slug,
        before: localNameTh,
        after: d1TitleTh
      });
      changedCount++;
    } else if (d1TitleTh) {
      // D1 also has mojibake — can't recover
      report.d1Mojibake.push({ slug, d1Raw: d1TitleTh });
    }
  }

  // Backup original before writing
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.writeFileSync(BACKUP_PATH, rawBytes);
    console.log('Backup written: ' + BACKUP_PATH);
  } else {
    console.log('Backup already exists: ' + BACKUP_PATH);
  }

  // Write cleaned JSON with 2-space indentation (matches existing style)
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Cleaned JSON written: ' + DATA_PATH + ' (' + changedCount + ' products updated)');

  // Write report
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('Report written: ' + REPORT_PATH);
  console.log('\nSummary:');
  console.log('  Total products: ' + report.totalProducts);
  console.log('  Matched in D1: ' + report.d1Matched.length);
  console.log('  Already clean in JSON: ' + report.alreadyClean.length);
  console.log('  Replaced from D1: ' + report.replacedFromD1.length);
  console.log('  Not in D1 (skipped): ' + report.notInD1.length);
  console.log('  D1 also mojibake (no recovery): ' + report.d1Mojibake.length);

  if (report.notInD1.length > 0) {
    console.log('\nSlugs not in D1:');
    for (const s of report.notInD1) console.log('  - ' + s);
  }
  if (report.d1Mojibake.length > 0) {
    console.log('\nSlugs where D1 also has mojibake:');
    for (const r of report.d1Mojibake) console.log('  - ' + r.slug);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
