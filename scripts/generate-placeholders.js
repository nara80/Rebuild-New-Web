const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Color palette matching brand
const colors = {
  fitted:   { bg: '#F1EFE1', text: '#5A4A3A', label: 'Fitted Sheets' },
  flat:     { bg: '#E1D1B1', text: '#5A4A3A', label: 'Flat Sheets' },
  duvet:    { bg: '#E9B7BF', text: '#5A4A3A', label: 'Duvet Covers' },
  pillow:   { bg: '#D9D1C1', text: '#5A4A3A', label: 'Pillowcases' },
  protector:{ bg: '#f3e5ab', text: '#5A4A3A', label: 'Protectors' },
  marine:   { bg: '#5A7DA2', text: '#FFFFFF', label: 'Marine & Yacht' },
  family:   { bg: '#618283', text: '#FFFFFF', label: 'Family' },
  pets:     { bg: '#E9B7BF', text: '#5A4A3A', label: 'Pet Owner' },
  rv:       { bg: '#4D545B', text: '#FFFFFF', label: 'RV & Truck' },
  product:  { bg: '#f8f9fa', text: '#333333', label: '' },
};

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
  const cats = path.join(__dirname, '../public/images/Categories');
  const prods = path.join(__dirname, '../public/images/products');

  // Ensure dirs exist
  [cats, prods].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // --- Category images ---
  await generate(path.join(cats, 'category-pets.jpg'),              { ...colors.pets,      label: 'Pet Owner',       sublabel: 'BreezePlus Anti-Fur' });
  await generate(path.join(cats, 'category-rv-truck.jpg'),          { ...colors.rv,        label: 'RV & Truck Cab',  sublabel: 'Custom Mobile Bedding' });
  await generate(path.join(cats, 'category-fitted-sheets.jpg'),     { ...colors.fitted,    label: 'Fitted Sheets',   sublabel: 'Custom Made to Measure' });
  await generate(path.join(cats, 'category-flat-sheets.jpg'),       { ...colors.flat,      label: 'Flat Sheets',     sublabel: 'Standard & Extra Deep' });
  await generate(path.join(cats, 'category-duvet-covers.jpg'),       { ...colors.duvet,     label: 'Duvet Covers',    sublabel: '3-Sided Zipper Design' });
  await generate(path.join(cats, 'category-pillowcases.jpg'),        { ...colors.pillow,    label: 'Pillowcases',     sublabel: 'Envelope, Zipper, Sham' });
  await generate(path.join(cats, 'category-mattress-protectors.jpg'),{ ...colors.protector, label: 'Protectors',      sublabel: 'Waterproof & Encasement' });

  // --- Product detail images ---
  const productImages = [
    ['pet-owner-fitted-sheet.jpg',       'Pet Owner Fitted Sheet',       'BreezePlus — Anti-Fur'],
    ['pet-owner-duvet-cover.jpg',        'Pet Owner Duvet Cover',        'BreezePlus — Easy Clean'],
    ['adjustable-mattress-fitted-sheet.jpg','Adjustable Fitted Sheet',     'Deep Pocket Design'],
    ['flat-sheet-standard.jpg',          'Standard Flat Sheet',          'All Standard Sizes'],
    ['flat-sheet-extra-deep-pocket.jpg', 'Extra Deep Pocket Flat Sheet', 'Up to 20" / 50cm'],
    ['pillowcase-envelope.jpg',          'Envelope Pillowcase',          'Classic Tuck-In Closure'],
    ['pillowcase-zipper.jpg',            'Zipper Pillowcase',            'Secure Enclosure'],
    ['pillowcase-sham.jpg',              'Sham Pillowcase',              'Decorative Flange Edge'],
    ['pet-proof-mattress-protector.jpg',  'Pet-Proof Protector',          'Waterproof TPU — Custom Skirt'],
  ];

  for (const [filename, label, sublabel] of productImages) {
    await generate(path.join(prods, filename), { ...colors.product, label, sublabel });
  }

  console.log('\nAll placeholder images generated successfully!');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
