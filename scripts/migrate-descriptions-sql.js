// migrate-descriptions-sql.js
// Generates SQL UPDATE statements to seed product descriptions into D1.
// Output: data/migrate-descriptions.sql

const fs = require('fs');

const content = JSON.parse(fs.readFileSync('data/product-content.json', 'utf8'));
const products = content.products;
const slugs = Object.keys(products);

function esc(s) {
  return s.replace(/'/g, "''");
}

function buildBullets(arr) {
  if (!arr || arr.length === 0) return '';
  return arr.map(b => '<li>' + b + '</li>').join('\n');
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

var lines = ['-- Migrate product descriptions from product-content.json to D1'];
var count = 0;

for (var i = 0; i < slugs.length; i++) {
  var slug = slugs[i];
  var desc = buildDescription(products[slug]);
  if (!desc) continue;
  count++;
  lines.push("UPDATE products SET description_en = '" + esc(desc) + "' WHERE slug = '" + esc(slug) + "';");
}

var sql = lines.join('\n');
var outPath = 'data/migrate-descriptions.sql';
fs.writeFileSync(outPath, sql, 'utf8');
console.log('Generated ' + outPath + ' with ' + count + ' UPDATE statements.');
console.log('Run: npx wrangler d1 execute mildmate-db --file=data/migrate-descriptions.sql');
