var fs = require('fs');
var path = require('path');

// Fix all EN product pages - replace non-ASCII punctuation with ASCII equivalents
// This fixes: em dash (U+2014) → " -- " (ASCII dash pair)
//            en dash (U+2013) → "-"
//            TH baht (U+0E3F) → "$"
// etc.

var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);
var fixes = [];

dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  
  var content = fs.readFileSync(f, 'utf8');
  var original = content;
  
  // Fix 1: Replace em dash U+2014 (â€") with ASCII equivalent
  content = content.split('\u2014').join(' -- ');
  
  // Fix 2: Replace en dash U+2013 with hyphen
  content = content.split('\u2013').join('-');
  
  // Fix 3: Replace TH baht U+0E3F with $
  content = content.split('\u0E3F').join('$');
  
  // Fix 4: Replace left double quote U+201C with "
  content = content.split('\u201C').join('"');
  
  // Fix 5: Replace right double quote U+201D with "
  content = content.split('\u201D').join('"');
  
  // Fix 6: Replace left single quote U+2018 with '
  content = content.split('\u2018').join("'");
  
  // Fix 7: Replace right single quote U+2019 with '
  content = content.split('\u2019').join("'");
  
  // Fix 8: Replace ellipsis U+2026 with ...
  content = content.split('\u2026').join('...');
  
  // Fix 9: Replace non-breaking space
  content = content.split('\u00A0').join(' ');
  
  // Fix 10: Replace guillemets
  content = content.split('\u00AB').join('<<');
  content = content.split('\u00BB').join('>>');
  
  // Fix 11: Replace bullet
  content = content.split('\u2022').join('*');
  
  if (content !== original) {
    fs.writeFileSync(f, content, 'utf8');
    fixes.push(dir);
    console.log('Fixed: ' + dir);
  }
});

console.log('\nTotal fixed: ' + fixes.length + ' files');
console.log('Files:', fixes.join(', '));
