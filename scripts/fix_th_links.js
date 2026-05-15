const fs = require('fs');
const path = require('path');

const base = 'D:/00_MildMate/Re-Build_Web/public';
// All TH pages (th/ subdirectory)
const thFiles = [
  'th/index.html',
  'th/about/index.html',
  'th/contact/index.html',
  'th/fabric/index.html',
  'th/shipping/index.html',
  'th/policy/index.html',
  'th/reviews/index.html',
  'th/faq/index.html',
  'th/custom-measurement/index.html',
  'th/how-to-measure-mattress-size/index.html',
  'th/sizeguide/index.html',
  'th/products/index.html',
  'th/fitted-sheets/index.html',
  'th/flat-sheets/index.html',
  'th/duvet-covers/index.html',
  'th/pillowcases/index.html',
  'th/mattress-protectors/index.html',
  'th/marine/index.html',
  'th/family/index.html',
  'th/pets/index.html',
  'th/duvet/index.html',
  'th/protection/index.html',
  'th/rv-truck/index.html',
];

const replacements = [
  // Top-level nav (no existing /th/ prefix — add /th/ prefix
  ['href="/products/"', 'href="/th/products/"'],
  ['href="/fabric/"', 'href="/th/fabric/"'],
  ['href="/sizeguide/"', 'href="/th/sizeguide/"'],
  ['href="/about/"', 'href="/th/about/"'],
  ['href="/contact/"', 'href="/th/contact/"'],
  ['href="/reviews/"', 'href="/th/reviews/"'],
  ['href="/shipping/"', 'href="/th/shipping/"'],
  ['href="/policy/"', 'href="/th/policy/"'],
  ['href="/faq/"', 'href="/th/faq/"'],
  ['href="/blogs/"', 'href="/th/blogs/"'],
  // Hero CTA buttons
  ['href="/how-to-measure-mattress-size/"', 'href="/th/how-to-measure-mattress-size/"'],
  ['href="/custom-measurement/"', 'href="/th/custom-measurement/"'],
];

let updated = 0;
let errors = 0;

for (const file of thFiles) {
  const filePath = path.join(base, file);
  if (!fs.existsSync(filePath)) {
    console.log('MISSING:', file);
    errors++;
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [search, replace] of replacements) {
    if (content.includes(search)) {
      content = content.split(search).join(replace);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', file);
    updated++;
  } else {
    console.log('No changes:', file);
  }
}

console.log(`\nDone. Updated: ${updated}, Errors: ${errors}`);
