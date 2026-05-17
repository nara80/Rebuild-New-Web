var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';
var imgDir = path.join(base, 'images', 'products');

// Build map: old filename -> { newSlug, newFilename }
// Based on AGENTS.md product catalog
var IMAGE_MAP = {
  '3-sided-duvet.jpg':                          { slug: '3-sided-duvet',           name: 'main.jpg' },
  'bedbridge-connector.jpg':                    { slug: 'bedbridge-connector',     name: 'main.jpg' },
  'bedbridge-connector-th.jpg':                  { slug: 'bedbridge-connector',     name: 'main-th.jpg' },
  'boat-fitted-sheet.jpg':                       { slug: 'boat-fitted-sheet',       name: 'main.jpg' },
  'deep-pocket-fitted-sheet.jpg':                { slug: 'deep-pocket-fitted-sheet', name: 'main.jpg' },
  'dorm-fitted-sheet.jpg':                       { slug: 'dorm-fitted-sheet',        name: 'main.jpg' },
  'duvet-cover-dorm.jpg':                        { slug: 'duvet-cover-dorm',         name: 'main.jpg' },
  'duvet-cover-marine.jpg':                      { slug: 'duvet-cover-marine',       name: 'main.jpg' },
  'duvet-cover-rv.jpg':                          { slug: 'duvet-cover-rv',           name: 'main.jpg' },
  'duvet-insert.jpg':                            { slug: 'duvet-insert',             name: 'main.jpg' },
  'family-co-sleeping-solutions-th-size.jpg':    { slug: 'family-fitted-sheet',      name: 'main-th.jpg' },
  'family-fitted-sheet.jpg':                     { slug: 'family-fitted-sheet',      name: 'main.jpg' },
  'flat-sheet-extra-deep-pocket.jpg':            { slug: 'flat-sheet-extra-deep-pocket', name: 'main.jpg' },
  'flat-sheet-standard.jpg':                     { slug: 'flat-sheet-standard',     name: 'main.jpg' },
  'marine-fitted-sheet.jpg':                     { slug: 'marine-fitted-sheet',     name: 'main.jpg' },
  'mattress-encasement-general.jpg':             { slug: 'mattress-encasement-general', name: 'main.jpg' },
  'mattress-lift-helper.jpg':                    { slug: 'mattress-lift-helper',     name: 'main.jpg' },
  'mattress-protector-deep-pocket.jpg':           { slug: 'mattress-protector-deep-pocket', name: 'main.jpg' },
  'mattress-protector-dorm.jpg':                  { slug: 'mattress-protector-dorm', name: 'main.jpg' },
  'mattress-protector-family.jpg':               { slug: 'mattress-protector-family', name: 'main.jpg' },
  'mattress-protector-pet.jpg':                   { slug: 'pet-proof-mattress-protector', name: 'main.jpg' },
  'mattress-protector-standard.jpg':              { slug: 'mattress-protector-standard', name: 'main.jpg' },
  'pet-owner-duvet-cover.jpg':                   { slug: 'pet-owner-duvet-cover',   name: 'main.jpg' },
  'pet-owner-fitted-sheet.jpg':                  { slug: 'pet-owner-fitted-sheet', name: 'main.jpg' },
  'pillowcase-envelope.jpg':                      { slug: 'pillowcase-envelope',     name: 'main.jpg' },
  'pillowcase-sham.jpg':                          { slug: 'pillowcase-sham',         name: 'main.jpg' },
  'pillowcase-zipper.jpg':                       { slug: 'pillowcase-zipper',       name: 'main.jpg' },
  'pillow-protector-general.jpg':                { slug: 'pillow-protector-general', name: 'main.jpg' },
  'rv-truck-fitted-sheet.jpg':                   { slug: 'rv-truck-fitted-sheet',  name: 'main.jpg' },
  'rv-truck-mattress-encasement.jpg':            { slug: 'rv-truck-mattress-encasement', name: 'main.jpg' },
  'standard-fitted-sheet.jpg':                   { slug: 'standard-fitted-sheet',  name: 'main.jpg' },
};

// 1. Create directories and move files
var files = fs.readdirSync(imgDir);
var moved = [];
var errors = [];

files.forEach(function(fname) {
  if (!fname.endsWith('.jpg')) return;
  var entry = IMAGE_MAP[fname];
  if (!entry) {
    console.log('UNMAPPED: ' + fname);
    return;
  }
  var newDir = path.join(imgDir, entry.slug);
  var newPath = path.join(newDir, entry.name);

  try {
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.copyFileSync(path.join(imgDir, fname), newPath);
    moved.push({ from: fname, to: entry.slug + '/' + entry.name });
  } catch(e) {
    errors.push({ file: fname, error: e.message });
  }
});

console.log('Moved ' + moved.length + ' files:');
moved.forEach(function(m) { console.log('  ' + m.from + ' -> images/products/' + m.to); });
if (errors.length > 0) {
  console.log('\nErrors:');
  errors.forEach(function(e) { console.log('  ' + e.file + ': ' + e.error); });
}

// 2. Build old -> new path map for all HTML files
var PATH_MAP = {};
Object.keys(IMAGE_MAP).forEach(function(old) {
  var entry = IMAGE_MAP[old];
  var oldPath = '/images/products/' + old;
  var newPath = '/images/products/' + entry.slug + '/' + entry.name;
  PATH_MAP[oldPath] = newPath;
});

// 3. Scan and update all HTML files
var htmlFiles = [];
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) htmlFiles.push(f);
  });
}
walk(path.join(base));

var updated = [];
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var original = s;
  Object.keys(PATH_MAP).forEach(function(oldPath) {
    s = s.split(oldPath).join(PATH_MAP[oldPath]);
  });
  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    updated.push(f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''));
  }
});

console.log('\nUpdated ' + updated.length + ' HTML files:');
updated.forEach(function(f) { console.log('  ' + f); });

// 4. Verify - scan all remaining product image refs
var allImages = [];
function getAllImages(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) getAllImages(f);
    else if (e.isFile() && f.endsWith('.jpg')) allImages.push('/' + f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', '').replace(/^\//, ''));
  });
}
getAllImages(path.join(base, 'images'));

var broken = [];
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var refs = s.match(/\/images\/products\/[^\s"')>]+/g) || [];
  refs.forEach(function(ref) {
    var p = path.join(base, ref.replace(/^\//, '').replace(/\//g, path.sep));
    if (!fs.existsSync(p) && !allImages.some(function(a) { return a.endsWith(path.basename(ref)); })) {
      broken.push({ file: f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''), ref: ref });
    }
  });
});
console.log('\nBroken image refs remaining: ' + broken.length);
if (broken.length > 0) broken.slice(0, 10).forEach(function(b) { console.log('  ' + b.file + ' => ' + b.ref); });
