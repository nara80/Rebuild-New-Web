const fs = require('fs');
const path = require('path');

const base = 'D:/00_MildMate/Re-Build_Web/public';

const enPages = [
  'products/index.html',
  'fitted-sheets/index.html',
  'flat-sheets/index.html',
  'duvet-covers/index.html',
  'pillowcases/index.html',
  'mattress-protectors/index.html',
  'marine/index.html',
  'family/index.html',
  'pets/index.html',
  'duvet/index.html',
  'protection/index.html',
  'rv-truck/index.html',
];
const thPages = [
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

const allPages = [...enPages, ...thPages];

let updated = 0;
let skipped = 0;

for (const page of allPages) {
  const filePath = path.join(base, page);
  if (!fs.existsSync(filePath)) {
    console.log('MISSING:', page);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  if (page.startsWith('th/')) {
    // TH: กำหนดเอง → ดูตัวเลือก
    if (content.includes('>กำหนดเอง<')) {
      content = content.replace(/<a href="([^"]*)" class="btn btn-primary">กำหนดเอง<\/a>/g,
        '<a href="$1" class="btn btn-primary">ดูตัวเลือก</a>');
      changed = true;
    }
  } else {
    // EN: Customize → View Options
    if (content.includes('>Customize<')) {
      content = content.replace(/<a href="([^"]*)" class="btn btn-primary">Customize<\/a>/g,
        '<a href="$1" class="btn btn-primary">View Options</a>');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', page);
    updated++;
  } else {
    console.log('No change:', page);
    skipped++;
  }
}

console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
