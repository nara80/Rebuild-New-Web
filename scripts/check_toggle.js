const fs = require('fs');
const c = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/sizeguide/index.html', 'utf8');
const idx = c.indexOf('lang-toggle');
console.log('lang-toggle found at:', idx);
if (idx >= 0) {
  console.log('Context:', c.substring(idx - 50, idx + 300));
}
// Check all data-lang attributes
const matches = [...c.matchAll(/data-lang="([^"]+)"/g)];
console.log('data-lang values:', matches.map(m => m[1]));
// Count
console.log('lang-toggle class occurrences:', (c.match(/class="lang-toggle"/g) || []).length);
console.log('data-lang occurrences:', (c.match(/data-lang=/g) || []).length);
