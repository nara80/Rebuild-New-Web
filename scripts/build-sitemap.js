const fs = require('fs');
const fg = require('fast-glob');
const base = 'https://www.mildmate.com';
const exclude = new Set(['/account/', '/checkout/', '/order-confirmed/', '/unsubscribe/', '/th/checkout/']);
const files = fg.sync(['public/**/index.html', '!public/admin/**', '!public/images/**']);
const routes = files
  .map(f => '/' + f.replace(/^public\//, '').replace(/\\/g, '/').replace(/\/index\.html$/, '/'))
  .map(r => r === '/index.html' ? '/' : r)
  .filter(r => !exclude.has(r))
  .sort();
const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
for (const r of routes) {
  lines.push('  <url>');
  lines.push('    <loc>' + base + r + '</loc>');
  lines.push('    <lastmod>' + today + '</lastmod>');
  lines.push('  </url>');
}
lines.push('</urlset>');
fs.writeFileSync('public/sitemap.xml', lines.join('\n'));
console.log('wrote', routes.length, 'URLs');
