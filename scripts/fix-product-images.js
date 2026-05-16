const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../public');

// Replacements: [oldString, newString]
const replacements = [
  ['/images/products/tbar.jpg',                               '/images/products/bedbridge-connector.jpg'],
  ['/images/products/product-boat-bedding-fitted-sheet-microfiber.jpg', '/images/products/marine-fitted-sheet.jpg'],
  ['/images/products/sheet-protectors.jpg',                  '/images/products/mattress-encasement-general.jpg'],
];

// Only replace pet-proof in listing pages (not the actual product detail page)
const petProofListingPages = [
  ['/pets/index.html',           '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/family/index.html',        '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/fitted-sheets/index.html', '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/mattress-protectors/index.html', '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/boarding-dorm/index.html', '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/products/index.html',       '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/index.html',              '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/th/pets/index.html',           '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/th/family/index.html',         '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/th/fitted-sheets/index.html', '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/th/mattress-protectors/index.html', '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/th/boarding-dorm/index.html', '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
  ['/th/index.html',              '/images/products/pet-proof-mattress-protector.jpg', '/images/products/mattress-protector-pet.jpg'],
];

function processFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [oldStr, newStr] of replacements) {
    if (content.includes(oldStr)) {
      content = content.split(oldStr).join(newStr);
      changed = true;
      console.log(`  FIX: ${path.relative(root, filePath)} — ${oldStr} → ${newStr}`);
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return changed;
}

function processFileForPetProof(filePath, pageSpecificReplacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [oldStr, newStr] of pageSpecificReplacements) {
    if (content.includes(oldStr)) {
      content = content.split(oldStr).join(newStr);
      changed = true;
      console.log(`  FIX: ${path.relative(root, filePath)} — PET PROOF — ${oldStr} → ${newStr}`);
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return changed;
}

// Walk all HTML files
function walk(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

const htmlFiles = walk(root);
console.log(`\nProcessing ${htmlFiles.length} HTML files...\n`);

// Step 1: Global replacements (tbar, marine sheet, sheet-protectors)
for (const file of htmlFiles) {
  processFile(file, replacements);
}

// Step 2: Pet-proof listing pages only (normalize to forward slashes for comparison)
for (const file of htmlFiles) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const applicableFixes = petProofListingPages
    .filter(([page]) => rel.endsWith(page))
    .map(([, oldStr, newStr]) => [oldStr, newStr]);
  if (applicableFixes.length > 0) {
    processFileForPetProof(file, applicableFixes);
  }
}

console.log('\nDone.');
