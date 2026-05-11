const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '..', 'public');
const scriptTag = '  <script src="/js/cookie-consent.js"></script>';

function findHtmlFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHtmlFiles(fullPath, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

const htmlFiles = findHtmlFiles(publicDir);
let updated = 0;
let skipped = 0;

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf-8');

  // Skip if already has cookie-consent.js
  if (content.includes('cookie-consent.js')) {
    skipped++;
    console.log(`Skipped (already has): ${path.relative(publicDir, file)}`);
    continue;
  }

  // Insert before </body>
  const newContent = content.replace(/<\/body>/, `${scriptTag}\n</body>`);

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf-8');
    updated++;
    console.log(`Updated: ${path.relative(publicDir, file)}`);
  } else {
    skipped++;
    console.log(`Pattern not matched: ${path.relative(publicDir, file)}`);
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
