var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// Broken product link -> correct product link
var FIXES = [
  ['/product/adjustable-mattress-fitted-sheet/',      '/product/standard-fitted-sheet/'],
  ['/product/family-co-sleeping-solutions-th-size/',  '/product/family-fitted-sheet/'],
  ['/product/pillow-protector/',                     '/product/pillow-protector-general/'],
  ['/product/product-boat-bedding-fitted-sheet-microfiber/', '/product/boat-fitted-sheet/'],
  ['/product/rv-truck-pillow-protector/',            '/product/pillow-protector-general/'],
  ['/product/sheet-protectors/',                     '/product/mattress-protector-standard/'],
  ['/product/tbar/',                                 '/product/bedbridge-connector/'],
];

var htmlFiles = [];
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) htmlFiles.push(f);
  });
}
walk(base);

var totalFixed = 0;
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var original = s;
  FIXES.forEach(function(fix) {
    s = s.split(fix[0]).join(fix[1]);
  });
  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    totalFixed++;
    var rel = f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', '');
    console.log('Fixed: ' + rel);
  }
});

console.log('\nFiles updated: ' + totalFixed);

// Verify
console.log('\n=== RE-CHECKING ===');
var broken = [];
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var hrefs = s.match(/href="(\/product\/[^"#]+)"/g) || [];
  hrefs.forEach(function(h) {
    var url = h.match(/href="([^"]+)"/)[1];
    var slug = url.replace('/product/', '').replace(/\/$/, '');
    var diskPath = path.join(base, 'product', slug);
    if (!fs.existsSync(diskPath) && !fs.existsSync(diskPath + '/index.html')) {
      broken.push(url + ' in ' + f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''));
    }
  });
});
if (broken.length === 0) {
  console.log('All product links valid! 0 broken.');
} else {
  console.log('Still broken: ' + broken.length);
  broken.forEach(function(b) { console.log('  ' + b); });
}
