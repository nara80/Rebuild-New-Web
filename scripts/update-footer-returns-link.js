const fs = require('fs');
const path = require('path');

const publicDir = path.resolve(__dirname, '..', 'public');

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
  let newContent = content;

  // Replace English footer link text
  newContent = newContent.replace(/Shipping &amp; Return Policy/g, 'Returns &amp; Delivery');
  newContent = newContent.replace(/Shipping & Return Policy/g, 'Returns & Delivery');

  // Replace Thai footer link text
  newContent = newContent.replace(/นโยบายการจัดส่งและคืนสินค้า/g, 'นโยบายการจัดส่งและคืนสินค้า');
  // Note: Thai text is already correct as "Shipping & Return" = "การจัดส่งและคืนสินค้า"
  // "Returns & Delivery" in Thai would be "การจัดส่งและคืนสินค้า" which is the same concept
  // Let's keep Thai as is for now since the user didn't specify Thai translation

  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf-8');
    updated++;
    console.log(`Updated: ${path.relative(publicDir, file)}`);
  } else {
    skipped++;
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped.`);
