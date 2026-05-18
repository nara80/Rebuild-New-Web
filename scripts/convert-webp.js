// convert-webp.js — Convert JPG/PNG images to WebP for performance
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

const images = [
  // Hero
  'Hero01.jpg',
  // Category thumbnails
  'Categories/category-sheets.jpg',
  'Categories/category-duvet-covers.jpg',
  'Categories/category-pillowcases.jpg',
  'Categories/category-protection.jpg',
  'Categories/category-accessories.jpg',
  'Categories/category-marine.jpg',
  'Categories/category-family.jpg',
  'Categories/category-pets.jpg',
  'Categories/category-deep-pocket.jpg',
  'Categories/category-boarding-dorm.jpg',
  'Categories/category-rv-truck.jpg',
];

async function convertToWebp(filename) {
  const srcPath = path.join(IMAGES_DIR, filename);
  const destPath = srcPath.replace(/\.(jpe?g|png)$/i, '.webp');

  if (!fs.existsSync(srcPath)) {
    console.log(`SKIP (missing): ${filename}`);
    return;
  }

  const srcSize = fs.statSync(srcPath).size;

  await sharp(srcPath)
    .webp({ quality: 85, effort: 6 })
    .toFile(destPath);

  const destSize = fs.statSync(destPath).size;
  const savings = ((1 - destSize / srcSize) * 100).toFixed(1);
  console.log(`OK  (${(srcSize / 1024).toFixed(1)} KB → ${(destSize / 1024).toFixed(1)} KB, -${savings}%): ${filename} → ${path.basename(destPath)}`);
}

async function main() {
  console.log('Converting images to WebP...\n');
  const start = Date.now();

  for (const img of images) {
    await convertToWebp(img);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

main().catch(err => { console.error(err); process.exit(1); });
