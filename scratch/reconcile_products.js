const fs = require('fs');
const path = require('path');

const contentPath = path.join(__dirname, '../data/product-content.json');
let content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const supportsPremaCotton = (key, prod) => {
  const premSupportedKeys = [
    'standard-fitted-sheet',
    'deep-pocket-fitted-sheet',
    'flat-sheet-standard',
    'flat-sheet-extra-deep-pocket',
    '3-sided-duvet',
    'pillowcase-envelope',
    'pillowcase-zipper',
    'pillowcase-sham'
  ];
  if (premSupportedKeys.includes(key)) return true;
  if (prod.fabrics && prod.fabrics.includes('premacotton')) return true;
  return false;
};

const cleanText = (text, hasPremaCotton) => {
  if (!text) return text;
  let newText = text;

  // Clean cooling claims (for all products)
  newText = newText
    .replace(/3\s*-\s*5\s*°C\s*cooler\s*than\s*standard\s*cotton\s*-\s*/gi, 'cool-to-the-touch comfort — ')
    .replace(/3\s*-\s*5\s*°C\s*cooler\s*than\s*standard\s*cotton/gi, 'cool-to-the-touch comfort')
    .replace(/3\s*-\s*5\s*°C\s*cooler\s*than\s*cotton/gi, 'cool-to-the-touch comfort')
    .replace(/3\s*-\s*5\s*°C\s*cooler/gi, 'cool-to-the-touch')
    .replace(/3\s*-\s*5\s*&deg;C\s*cooler\s*than\s*cotton/gi, 'cool-to-the-touch comfort')
    .replace(/3\s*-\s*5\s*&deg;C\s*cooler\s*than\s*standard\s*cotton/gi, 'cool-to-the-touch comfort')
    .replace(/3\s*-\s*5\s*&deg;C\s*cooler/gi, 'cool-to-the-touch')
    .replace(/3\s*-\s*5\s*°C\s*Cooler\s*Than\s*Cotton/g, 'Cool-to-the-Touch')
    .replace(/3-5°C/g, 'Cool-to-the-touch')
    .replace(/3-5°C Cooler/gi, 'Cool-to-the-touch')
    .replace(/cool-to-the-touch\s+than\s+(standard\s+)?cotton/gi, 'cool-to-the-touch comfort');

  // Clean OEKO-TEX claims
  if (hasPremaCotton) {
    // Qualify OEKO-TEX for PremaCotton
    newText = newText
      .replace(/100%\s*chemical-free\s*-\s*OEKO-TEX\s*certified/gi, 'PremaCotton option is OEKO-TEX® certified')
      .replace(/OEKO-TEX\s*certified\s*-\s*no\s*toxic\s*chemicals/gi, 'PremaCotton option is OEKO-TEX® certified')
      .replace(/OEKO-TEX\s*certified\s*-\s*no\s*harmful\s*chemicals/gi, 'PremaCotton option is OEKO-TEX® certified')
      .replace(/OEKO-TEX\s*certified\s*—\s*no\s*toxic\s*chemicals/gi, 'PremaCotton option is OEKO-TEX® certified')
      .replace(/OEKO-TEX\s*certified\s*-\s*no\s*toxic\s*dye\s*or\s*finish/gi, 'PremaCotton option is OEKO-TEX® certified')
      .replace(/OEKO-TEX\s*certified/gi, 'PremaCotton option is OEKO-TEX® certified')
      .replace(/OEKO-TEX\s*certification/gi, 'PremaCotton option has OEKO-TEX® certification');
  } else {
    // Remove OEKO-TEX claims completely
    newText = newText
      .replace(/[\.,\s]*OEKO-TEX\s*certified[\.,\s]*/gi, '. ')
      .replace(/[\.,\s]*OEKO-TEX\s*certified\s*materials[\.,\s]*/gi, '. ')
      .replace(/[\.,\s]*OEKO-TEX\s*certified\s*for\s*safety[\.,\s]*/gi, '. ')
      .replace(/[\.,\s]*OEKO-TEX\s*certified\s*for\s*family\s*safety[\.,\s]*/gi, '. ')
      .replace(/[\.,\s]*Skin-safe\s*and\s*OEKO-TEX\s*certified[\.,\s]*/gi, '. Skin-safe. ')
      .replace(/[\.,\s]*100%\s*chemical-free\s*-\s*OEKO-TEX\s*certified[\.,\s]*/gi, '. ')
      .replace(/[\.,\s]*OEKO-TEX\s*certification[\.,\s]*/gi, '. ')
      .replace(/[\.,\s]*100%\s*chemical-free\s*—\s*OEKO-TEX\s*certified[\.,\s]*/gi, '. ')
      .replace(/OEKO-TEX/gi, '');

    // Cleanup double periods and spacing
    newText = newText.replace(/\.\s*\./g, '.').replace(/\s+/g, ' ').trim();
  }
  return newText;
};

// Iterate and clean
for (const [key, prod] of Object.entries(content.products)) {
  const hasPrem = supportsPremaCotton(key, prod);

  // Tagline and metaDescription
  if (prod.tagline) {
    prod.tagline = cleanText(prod.tagline, hasPrem);
  }
  if (prod.metaDescription) {
    prod.metaDescription = cleanText(prod.metaDescription, hasPrem);
  }
  if (prod.tabDescriptionP) {
    prod.tabDescriptionP = cleanText(prod.tabDescriptionP, hasPrem);
  }
  if (prod.tabFabricP) {
    prod.tabFabricP = cleanText(prod.tabFabricP, hasPrem);
  }

  // Bullets: filter/map
  if (prod.tabDescriptionBullets) {
    prod.tabDescriptionBullets = prod.tabDescriptionBullets
      .map(b => cleanText(b, hasPrem))
      .filter(b => {
        if (!hasPrem && b.toLowerCase().includes('oeko')) return false;
        if (b === '.' || b === '') return false;
        return true;
      });
  }
  if (prod.tabFabricBullets) {
    prod.tabFabricBullets = prod.tabFabricBullets
      .map(b => cleanText(b, hasPrem))
      .filter(b => {
        if (!hasPrem && b.toLowerCase().includes('oeko')) return false;
        if (b === '.' || b === '') return false;
        return true;
      });
  }
}

fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf8');
console.log('Reconciliation and cleanup of product-content.json complete.');
