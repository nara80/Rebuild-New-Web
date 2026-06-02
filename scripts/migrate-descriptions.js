// migrate-descriptions.js
// Seeds all 27 product descriptions from product-content.json into D1 via the admin API.
// Usage: node scripts/migrate-descriptions.js [--local|--prod]
//   --local   → http://localhost:8788 (requires `npx wrangler dev` running)
//   --prod    → https://mildmate-new.pages.dev (default)
//
// The admin secret is read from ADMIN_SECRET env var, or falls back to
// "mildmate-sandbox-secret-2025" (sandbox default).

const fs = require('fs');

const BASE = process.argv.includes('--local')
  ? 'http://localhost:8788'
  : 'https://mildmate-new.pages.dev';

const SECRET = process.env.ADMIN_SECRET || 'mildmate-sandbox-secret-2025';

const content = JSON.parse(fs.readFileSync('data/product-content.json', 'utf8'));
const products = content.products;
const slugs = Object.keys(products);

function buildBullets(arr) {
  if (!arr || arr.length === 0) return '';
  return arr.map(b => '<li>' + b + '</li>').join('');
}

function buildDescription(p) {
  var html = '';
  if (p.tabDescriptionTitle) html += '<h3>' + p.tabDescriptionTitle + '</h3>\n';
  if (p.tabDescriptionP) html += '<p>' + p.tabDescriptionP + '</p>\n';
  var descBullets = buildBullets(p.tabDescriptionBullets);
  if (descBullets) html += '<ul>\n' + descBullets + '\n</ul>\n';
  if (p.tabFabricTitle) html += '<h3>' + p.tabFabricTitle + '</h3>\n';
  if (p.tabFabricP) html += '<p>' + p.tabFabricP + '</p>\n';
  var fabricBullets = buildBullets(p.tabFabricBullets);
  if (fabricBullets) html += '<ul>\n' + fabricBullets + '\n</ul>\n';
  return html.trim();
}

async function migrate() {
  console.log('Migrating descriptions to ' + BASE + ' ...\n');
  var ok = 0, fail = 0;

  for (var i = 0; i < slugs.length; i++) {
    var slug = slugs[i];
    var p = products[slug];
    var desc = buildDescription(p);

    if (!desc) {
      console.log('  SKIP  ' + slug + ' (no description)');
      continue;
    }

    console.log('  [' + (i + 1) + '/' + slugs.length + '] POST ' + slug + '  (' + desc.length + ' chars)');

    try {
      var resp = await fetch(BASE + '/api/admin/products/' + slug, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': SECRET
        },
        body: JSON.stringify({ description_en: desc })
      });

      var text = await resp.text();
      var data;
      try { data = JSON.parse(text); } catch(e) { data = null; }

      if (resp.ok && data && data.success) {
        ok++;
        console.log('         OK');
      } else {
        fail++;
        console.log('         FAIL (' + resp.status + '): ' + text.substring(0, 120));
      }
    } catch (e) {
      fail++;
      console.log('         ERROR: ' + e.message);
    }
  }

  console.log('\nDone: ' + ok + ' OK, ' + fail + ' failed, ' + (slugs.length - ok - fail) + ' skipped');
}

migrate();
