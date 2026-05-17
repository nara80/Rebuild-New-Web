var fs = require('fs');
var path = require('path');

// Rebuild image index with subfolders
var imgDir = 'D:/00_MildMate/Re-Build_Web/public/images/products';
var imgSet = {};
var allImages = [];

function scanDir(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) scanDir(f);
    else if (e.isFile()) {
      var rel = f.replace(/\\/g, '/').replace('D:/00_MildMate/Re-Build_Web/public/', '');
      allImages.push(rel);
      imgSet['/' + rel] = 1;
      imgSet[e.name] = 1;
    }
  });
}
scanDir(imgDir);

var base = 'D:/00_MildMate/Re-Build_Web/public';
var htmlFiles = [];
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) htmlFiles.push(f);
  });
}
walk(base);

// Check each HTML file for broken image refs
var broken = [];
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var refs = s.match(/\/images\/products\/[^\s"')>]+/g) || [];
  refs.forEach(function(ref) {
    var name = path.basename(ref);
    // Check if filename exists (flat check)
    if (!imgSet[name]) {
      broken.push({
        file: f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''),
        ref: ref
      });
    }
  });
});

console.log('Total missing image refs: ' + broken.length);
if (broken.length > 0) {
  broken.slice(0, 20).forEach(function(b) { console.log(b.file + ' => ' + b.ref); });
  if (broken.length > 20) console.log('...and ' + (broken.length - 20) + ' more');
} else {
  console.log('All clean - all image references resolve to existing files.');
}
