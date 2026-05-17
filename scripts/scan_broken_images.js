var fs = require('fs');
var path = require('path');

var imgDir = 'D:/00_MildMate/Re-Build_Web/public/images/products';
var images = fs.readdirSync(imgDir);
var imgSet = {};
images.forEach(function(n) { imgSet['/' + n] = 1; imgSet[n] = 1; });

var bad = [];
var files = [];

function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) files.push(f);
  });
}

walk('D:/00_MildMate/Re-Build_Web/public');

files.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var refs = s.match(/\/images\/products\/[^\s"')>]+\.(jpg|png|webp)/g);
  if (!refs) return;
  refs.forEach(function(ref) {
    var name = path.basename(ref);
    if (!imgSet[ref] && !imgSet[name]) {
      bad.push({ ref: ref, file: f.replace(/\\/g, '/').replace('D:/00_MildMate/Re-Build_Web/public/', '') });
    }
  });
});

console.log('Total missing image refs: ' + bad.length);
bad.forEach(function(b) {
  console.log(b.file + ' => ' + b.ref);
});
