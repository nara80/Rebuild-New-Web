var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

var pages = {
  'marine/index.html': 'V-Berth',
  'family/index.html': 'Co-Sleep',
  'pets/index.html': 'Pet Hair',
  'rv-truck/index.html': 'RV Truck',
};

// Remove ALL video guide cards (listing-card with "Watch Video" CTA or VIDEO badge)
Object.keys(pages).forEach(function(page) {
  var f = path.join(base, page);
  if (!fs.existsSync(f)) return;
  var s = fs.readFileSync(f, 'utf8');
  var original = s;

  // Pattern: article.listing-card containing card-video-badge or "Watch Video" link
  // Remove the full card block
  s = s.replace(/\s*<article class="listing-card"[^>]*>\s*<div class="card-image"[^>]*>\s*<img[^>]*\/?>\s*<div class="card-video-badge"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<div class="card-body"[\s\S]*?<\/article>/g, '');
  // Also remove any card that links to /custom-measurement/ as its CTA
  s = s.replace(/\s*<article class="listing-card"[^>]*>[\s\S]*?<a href="\/custom-measurement\/"[^>]*>Watch Video<\/a>[\s\S]*?<\/article>/g, '');

  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    console.log('Removed video card: ' + page + ' (' + pages[page] + ')');
  } else {
    console.log('No video card found: ' + page);
  }
});

console.log('\nDone.');
