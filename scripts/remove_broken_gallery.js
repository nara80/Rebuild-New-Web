var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// Broken gallery images: these are -2.jpg / -3.jpg / -4.jpg variants
// that reference second/third/fourth product photos that don't exist on disk
var BROKEN_SUFFIXES = ['-2.jpg', '-3.jpg', '-4.jpg'];

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
var totalRemoved = 0;

files.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var original = s;

  BROKEN_SUFFIXES.forEach(function(suffix) {
    // Remove all img tags referencing broken gallery images
    var re = new RegExp('<div class="gallery-thumb"[^>]*>\\s*<img[^>]*src="[^"]*' + suffix.replace('.', '\\.') + '"[^>]*>\\s*</div>', 'g');
    var removed = s.match(re);
    if (removed) totalRemoved += removed.length;
    s = s.replace(re, '');
  });

  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    totalFixed++;
    console.log('Cleaned: ' + f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''));
  }
});

console.log('\nFiles cleaned: ' + totalFixed + ' | Gallery thumbs removed: ' + totalRemoved);
