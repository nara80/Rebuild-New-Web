const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function escapeXml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
}

function svg({ width, height, bg, text, label, sublabel = '' }) {
  const fontSize = Math.floor(width / 12);
  const subSize = Math.floor(width / 20);
  const y1 = height / 2 - (sublabel ? fontSize / 2 : 0);
  const y2 = height / 2 + fontSize;
  const el = escapeXml(label);
  const es = sublabel ? escapeXml(sublabel) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <text x="50%" y="${y1}" dominant-baseline="middle" text-anchor="middle"
          font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="600" fill="${text}">
      ${el}
    </text>
    ${es ? `<text x="50%" y="${y2}" dominant-baseline="middle" text-anchor="middle"
          font-family="Arial,sans-serif" font-size="${subSize}" fill="${text}" opacity="0.8">
      ${es}
    </text>` : ''}
  </svg>`;
}

async function generate(outPath, opts) {
  const svgBuffer = Buffer.from(svg({ width: 800, height: 600, ...opts }));
  await sharp(svgBuffer)
    .jpeg({ quality: 90, background: opts.bg })
    .toFile(outPath);
  console.log('Created:', outPath);
}

(async () => {
  const prods = path.join(__dirname, '../public/images/products');
  if (!fs.existsSync(prods)) fs.mkdirSync(prods, { recursive: true });

  await generate(path.join(prods, 'pillow-protector.jpg'), {
    bg: '#f8f9fa',
    text: '#333333',
    label: 'Pillow Protector',
    sublabel: 'Waterproof / Dust-mite'
  });

  console.log('\nPillow protector placeholder generated!');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
