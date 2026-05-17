var fs = require('fs');

var files = [
  'D:/00_MildMate/Re-Build_Web/public/product/dorm-fitted-sheet/index.html',
  'D:/00_MildMate/Re-Build_Web/public/product/duvet-cover-dorm/index.html',
  'D:/00_MildMate/Re-Build_Web/public/th/product/dorm-fitted-sheet/index.html',
  'D:/00_MildMate/Re-Build_Web/public/th/product/duvet-cover-dorm/index.html',
];

files.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var original = s;

  // Remove mattress-protector-dorm related card (broken link, points to itself)
  // Pattern 1: full related card block (with div.card-image pointing to mattress-protector-dorm/main.jpg)
  s = s.replace(/<a href="[^"]*mattress-protector-dorm[^"]*" class="related-card"[^>]*>[\s\S]*?<\/a>/g, '');

  // Pattern 2: full related card block (TH version with broken link but no main.jpg)
  s = s.replace(/<a href="[^"]*mattress-protector-dorm[^"]*" class="related-card">[\s\S]*?<\/a>/g, '');

  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    console.log('Cleaned: ' + f.replace(/\\/g, '/').replace('D:/00_MildMate/Re-Build_Web/public/', ''));
  } else {
    console.log('No changes: ' + f.replace(/\\/g, '/').replace('D:/00_MildMate/Re-Build_Web/public/', ''));
  }
});

// Also clean protection/index.html (has mattress-protector-dorm listing card)
var protEn = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/protection/index.html', 'utf8');
var protEnNew = protEn.replace(/<div class="card-image"><img src="[^"]*mattress-protector-dorm[^"]*"[^>]*>[\s\S]*?<\/div>/g, '').replace(/<div class="card-tags">[\s\S]*?<\/div>\s*<h3[^>]*>Waterproof Mattress Protector[^<]*<\/h3>[\s\S]*?<a href="[^"]*mattress-protector-dorm[^"]*"[^>]*>[^<]*<\/a>/g, '');
// Actually, let's just remove the whole article.card for dorm
protEnNew = protEnNew.replace(/<article class="listing-card"[^>]*>\s*<div class="card-image"><img src="[^"]*mattress-protector-dorm[^"]*">[\s\S]*?<\/article>/g, '');
if (protEnNew !== protEn) {
  fs.writeFileSync('D:/00_MildMate/Re-Build_Web/public/protection/index.html', protEnNew, 'utf8');
  console.log('Cleaned: protection/index.html');
}

// And TH protection
var protTh = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/th/protection/index.html', 'utf8');
var protThNew = protTh.replace(/<article class="listing-card"[^>]*>\s*<div class="card-image"><img src="[^"]*mattress-protector-dorm[^"]*">[\s\S]*?<\/article>/g, '');
if (protThNew !== protTh) {
  fs.writeFileSync('D:/00_MildMate/Re-Build_Web/public/th/protection/index.html', protThNew, 'utf8');
  console.log('Cleaned: th/protection/index.html');
}

console.log('Done.');
