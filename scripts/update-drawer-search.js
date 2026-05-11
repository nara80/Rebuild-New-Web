const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '..', 'public');

const enSearchBlock = `      <div class="mobile-drawer-search">
        <form action="/products/" method="get" class="drawer-search-form">
          <input type="search" name="q" placeholder="Search bedding, fabrics, sizes..." aria-label="Search products" autocomplete="off">
          <button type="submit" aria-label="Submit search">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </form>
      </div>`;

const thSearchBlock = `      <div class="mobile-drawer-search">
        <form action="/products/" method="get" class="drawer-search-form">
          <input type="search" name="q" placeholder="ค้นหาผ้าปู ผ้า ขนาด..." aria-label="ค้นหาสินค้า" autocomplete="off">
          <button type="submit" aria-label="ส่งการค้นหา">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </form>
      </div>`;

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

  // Skip if already has mobile-drawer-search
  if (content.includes('mobile-drawer-search')) {
    skipped++;
    continue;
  }

  // Check if this file has a mobile drawer
  if (!content.includes('class="mobile-drawer"')) {
    skipped++;
    continue;
  }

  // Determine if Thai page (check for /th/ path or Thai lang attribute)
  const isThai = file.includes(path.sep + 'th' + path.sep) || content.includes('lang="th"');
  const searchBlock = isThai ? thSearchBlock : enSearchBlock;

  // Find the pattern: <div class="mobile-drawer" ...> followed by <ul class="mobile-nav-list">
  const pattern = /(<div class="mobile-drawer"[^>]*>)[\r\n\s]*(<ul class="mobile-nav-list">)/;
  const replacement = `$1\n${searchBlock}\n      $2`;

  const newContent = content.replace(pattern, replacement);

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
