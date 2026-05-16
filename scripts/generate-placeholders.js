const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Color palette matching brand
const colors = {
  fitted:    { bg: '#F1EFE1', text: '#5A4A3A', label: 'Fitted Sheets' },
  flat:      { bg: '#E1D1B1', text: '#5A4A3A', label: 'Flat Sheets' },
  duvet:     { bg: '#E9B7BF', text: '#5A4A3A', label: 'Duvet Covers' },
  pillow:    { bg: '#D9D1C1', text: '#5A4A3A', label: 'Pillowcases' },
  protector: { bg: '#f3e5ab', text: '#5A4A3A', label: 'Protectors' },
  marine:    { bg: '#5A7DA2', text: '#FFFFFF', label: 'Marine & Yacht' },
  family:    { bg: '#618283', text: '#FFFFFF', label: 'Family' },
  pets:      { bg: '#E9B7BF', text: '#5A4A3A', label: 'Pet Owner' },
  rv:        { bg: '#4D545B', text: '#FFFFFF', label: 'RV & Truck' },
  deeppocket:{ bg: '#7BAFD4', text: '#FFFFFF', label: 'Deep Pocket' },
  boarding:  { bg: '#E8D5B7', text: '#5A4A3A', label: 'Boarding Dorm' },
  product:   { bg: '#f8f9fa', text: '#333333', label: '' },
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
  const cats = path.join(__dirname, '../public/images/categories');
  const prods = path.join(__dirname, '../public/images/products');

  // Ensure dirs exist
  [cats, prods].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // --- Niche / Shop-by-Niche category images ---
  await generate(path.join(cats, 'category-marine.jpg'),       { ...colors.marine,     label: 'Marine & Yacht',    sublabel: 'V-Berth & Boat Custom Bedding' });
  await generate(path.join(cats, 'category-family.jpg'),        { ...colors.family,     label: 'Family Co-Sleep',  sublabel: 'Mega-Beds & BedBridge' });
  await generate(path.join(cats, 'category-pets.jpg'),           { ...colors.pets,       label: 'Pet Owner',        sublabel: 'BreezePlus Anti-Fur' });
  await generate(path.join(cats, 'category-deep-pocket.jpg'),   { ...colors.deeppocket, label: 'Deep Pocket',      sublabel: 'Thick Mattresses & Adjustable Bases' });
  await generate(path.join(cats, 'category-boarding-dorm.jpg'), { ...colors.boarding,   label: 'Boarding Dorm',    sublabel: 'Student Bedding — Ships Worldwide' });
  await generate(path.join(cats, 'category-rv-truck.jpg'),       { ...colors.rv,         label: 'RV & Truck Cab',   sublabel: 'CloudSoft Quick-Dry Bedding' });

  // --- Product-type category images ---
  await generate(path.join(cats, 'category-fitted-sheets.jpg'),      { ...colors.fitted,    label: 'Fitted Sheets',    sublabel: 'Custom Made to Measure' });
  await generate(path.join(cats, 'category-flat-sheets.jpg'),        { ...colors.flat,      label: 'Flat Sheets',      sublabel: 'Standard & Extra Deep Pocket' });
  await generate(path.join(cats, 'category-duvet-covers.jpg'),         { ...colors.duvet,     label: 'Duvet Covers',     sublabel: '3-Sided Zipper Design' });
  await generate(path.join(cats, 'category-pillowcases.jpg'),          { ...colors.pillow,    label: 'Pillowcases',      sublabel: 'Envelope, Zipper & Sham' });
  await generate(path.join(cats, 'category-mattress-protectors.jpg'),   { ...colors.protector, label: 'Mattress Protectors', sublabel: 'Waterproof & Encasement' });

  // --- Product detail images (22 product listings — 2026-05-16) ---
  const productImages = [
    // [filename, label, sublabel, color]
    ['3-sided-duvet.jpg',                      '3-Sided Zipper Duvet Cover',     'BreezePlus — Pet Owner',             colors.duvet],
    ['pet-owner-duvet-cover.jpg',              'Pet Owner Duvet Cover',            'BreezePlus — Anti-Fur',             colors.pets],
    ['rv-truck-duvet.jpg',                     'RV & Truck Duvet Cover',          'CloudSoft — Quick-Dry',             colors.rv],
    ['family-co-sleeping-solutions-th-size.jpg','Custom Family Fitted Sheet',       'Family Co-Sleep — All 4 Fabrics',   colors.family],
    ['pet-owner-fitted-sheet.jpg',             'Pet Owner Fitted Sheet',           'BreezePlus — Family Sizes',         colors.pets],
    ['marine-fitted-sheet.jpg',                'Marine Fitted Sheet (V-Berth)',   'CloudSoft — Boat Custom',           colors.marine],
    ['rv-truck-fitted-sheet.jpg',              'RV & Truck Fitted Sheet',         'CloudSoft — Quick-Dry',             colors.rv],
    ['adjustable-mattress-fitted-sheet.jpg',    'Adjustable Fitted Sheet',          'Deep Pocket — All 4 Fabrics',      colors.deeppocket],
    ['flat-sheet-standard.jpg',                'Flat Sheet — Standard',            'All 4 Fabric Collections',          colors.flat],
    ['flat-sheet-extra-deep-pocket.jpg',       'Flat Sheet — Extra Deep Pocket',   'Up to 20" / 50cm Depth',           colors.flat],
    ['pillowcase-envelope.jpg',                'Envelope Pillowcase',             'All 4 Fabric Collections',         colors.pillow],
    ['pillowcase-zipper.jpg',                  'Zipper Pillowcase',               'All 4 Fabric Collections',         colors.pillow],
    ['pillowcase-sham.jpg',                    'Sham Pillowcase',                 'All 4 Fabric Collections',         colors.pillow],
    ['pet-owner-pillowcase.jpg',               'Pet Owner Pillowcase',            'BreezePlus — Family Sizes',         colors.pets],
    ['rv-truck-pillowcase.jpg',                'RV & Truck Pillowcase',           'CloudSoft — Quick-Dry',            colors.rv],
    ['mattress-protector-standard.jpg',         'Waterproof Mattress Protector',    'Standard Sizes — BreezePlus',      colors.protector],
    ['mattress-protector-family.jpg',          'Waterproof Mattress Protector',   'Family Co-Sleep — Custom Width',    colors.family],
    ['mattress-protector-pet.jpg',             'Waterproof Mattress Protector',   'Pet Owner — Family Sizes',         colors.pets],
    ['mattress-protector-dorm.jpg',            'Waterproof Mattress Protector',   'Boarding Dorm — Single/Double',   colors.boarding],
    ['mattress-encasement-general.jpg',        '6-Sided Mattress Encasement',     'BreezePlus + CloudSoft',           colors.protector],
    ['rv-truck-mattress-encasement.jpg',        'RV & Truck Mattress Encasement', 'CloudSoft — Quick-Dry',            colors.rv],
    ['pillow-protector-general.jpg',           'Pillow Protector',                'All 4 Fabric Collections',       colors.pillow],
    ['rv-truck-pillow-protector.jpg',          'RV & Truck Pillow Protector',    'CloudSoft — Quick-Dry',           colors.rv],
    ['bedbridge-connector.jpg',                'BedBridge Connector',             'Family Co-Sleep Accessory',       colors.family],
  ];

  for (const [filename, label, sublabel, color] of productImages) {
    await generate(path.join(prods, filename), { ...color, label, sublabel });
  }

  console.log('\nAll placeholder images generated successfully!');
})().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
