var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// Replacements: old path -> new path
var REPLACEMENTS = [
  // Deleted product: adjustable-mattress-fitted-sheet.jpg
  ['/images/products/adjustable-mattress-fitted-sheet.jpg', '/images/products/standard-fitted-sheet.jpg'],
  // Wrong slug: rv-truck-pillow-protector-general.jpg
  ['/images/products/rv-truck-pillow-protector-general.jpg', '/images/products/pillow-protector-general.jpg'],
];

// Files with -2.jpg / -3.jpg gallery images that don't exist
// These are secondary gallery thumbs — we can remove them or keep broken refs
// For now, let's just remove the broken gallery thumb references

var files = [];
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) files.push(f);
  });
}
walk(base);

var totalFixed = 0;
files.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var original = s;
  REPLACEMENTS.forEach(function(r) {
    if (s.indexOf(r[0]) !== -1) {
      s = s.split(r[0]).join(r[1]);
    }
  });
  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    totalFixed++;
    console.log('Fixed: ' + f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''));
  }
});

console.log('\nTotal files fixed: ' + totalFixed);
