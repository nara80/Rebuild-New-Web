const fs = require('fs');
const path = require('path');

const base = 'D:/00_MildMate/Re-Build_Web/public';
const files = [
  'index.html',
  'products/index.html',
  'pets/index.html',
  'marine/index.html',
  'family/index.html',
  'duvet-covers/index.html',
  'duvet/index.html',
  'th/index.html',
  'th/products/index.html',
];

const oldUrl = '/product/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets/';
const newUrl = '/product/3-sided-duvet/';
const oldImg = '3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets.jpg';
const newImg = '3-sided-duvet.jpg';

let updated = 0;
for (const file of files) {
  const p = path.join(base, file);
  if (!fs.existsSync(p)) { console.log('MISSING:', file); continue; }
  let c = fs.readFileSync(p, 'utf8');
  let changed = false;
  if (c.includes(oldUrl)) { c = c.split(oldUrl).join(newUrl); changed = true; }
  if (c.includes(oldImg)) { c = c.split(oldImg).join(newImg); changed = true; }
  if (changed) {
    fs.writeFileSync(p, c, 'utf8');
    console.log('Updated:', file);
    updated++;
  } else {
    console.log('No changes:', file);
  }
}
console.log('Done. Updated:', updated, 'files.');
