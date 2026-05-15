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

const enDisclaimer = 'All prices are estimates. Final price calculated in configurator.';
const thDisclaimer = 'ราคาทั้งหมดเป็นค่าประมาณ ราคาสุดท้ายคำนวณจากตัวเลือกของคุณ';

const enDisclaimerShort = 'All prices are estimates';
const thDisclaimerShort = 'ราคาทั้งหมดเป็นค่าประมาณ';

for (const page of allPages) {
  const filePath = path.join(base, page);
  if (!fs.existsSync(filePath)) {
    console.log('MISSING:', page);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // 1. Remove price disclaimer
  if (content.includes(enDisclaimer)) {
    content = content.replace(enDisclaimer + '\n', '');
    changed = true;
  }
  if (content.includes(thDisclaimer)) {
    content = content.replace(thDisclaimer + '\n', '');
    changed = true;
  }
  // also remove inline-styled version ending in period
  const pTagEn = /<p class="small" style="text-align:center; margin-top:24px; color:#666;">All prices are estimates.*?<\/p>/;
  const pTagTh = /<p class="small" style="text-align:center; margin-top:24px; color:#666;">ราคาทั้งหมด.*?<\/p>/;
  if (pTagEn.test(content)) {
    content = content.replace(pTagEn, '');
    changed = true;
  }
  if (pTagTh.test(content)) {
    content = content.replace(pTagTh, '');
    changed = true;
  }

  // 2. Fix "Add to Cart" → "Customize" for BedBridge on ALL pages
  if (content.includes('>Add to Cart<')) {
    content = content.replace(/<a href="(\/product\/tbar\/)" class="btn btn-primary">Add to Cart<\/a>/g,
      '<a href="$1" class="btn btn-primary">กำหนดเอง</a>');
    changed = true;
  }

  // 3. Center 2-product grids on desktop
  // Pages with only 2 products (duvet-covers) need justify-content:center on the grid
  if (page.includes('duvet-covers') || page.includes('flat-sheets')) {
    if (content.includes('grid-template-columns:repeat(auto-fill')) {
      content = content.replace(
        /style="grid-template-columns:repeat\(auto-fill,minmax\(260px,1fr\)\); gap:24px;"/g,
        'style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:24px; justify-content:center;"'
      );
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', page);
  } else {
    console.log('No changes:', page);
  }
}

console.log('\nDone.');
