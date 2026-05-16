const sharp = require('sharp');
const path = require('path');

const configs = [
  { file: 'category-deep-pocket.jpg', bg: '#7BAFD4', text: '#FFFFFF', label: 'Deep Pocket', sub: 'Thick Mattresses and Adjustable Bases' },
  { file: 'category-boarding-dorm.jpg', bg: '#E8D5B7', text: '#5A4A3A', label: 'Boarding Dorm', sub: 'Student Bedding Ships Worldwide' },
];

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function makeSVG({ bg, text, label, sub }) {
  const fs2 = Math.floor(800 / 12);
  const ss = Math.floor(800 / 20);
  const y1 = 300 - (sub ? fs2 / 2 : 0);
  const y2 = 300 + fs2;
  const el = esc(label);
  const es = sub ? esc(sub) : '';
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="${esc(bg)}"/><text x="50%" y="${y1}" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fs2}" font-weight="600" fill="${esc(text)}">${el}</text>`;
  if (es) svg += `<text x="50%" y="${y2}" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="${ss}" fill="${esc(text)}" opacity="0.8">${es}</text>`;
  svg += '</svg>';
  return Buffer.from(svg);
}

(async () => {
  for (const cfg of configs) {
    const buf = makeSVG(cfg);
    const outPath = path.join(__dirname, `../public/images/Categories/${cfg.file}`);
    await sharp(buf).jpeg({ quality: 90 }).toFile(outPath);
    console.log('Created:', outPath);
  }
  console.log('Done.');
})();
