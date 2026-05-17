var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// Category page paths
var categoryPages = [
  'duvet-covers/index.html',
  'sheets/index.html',
  'protection/index.html',
  'pillowcases/index.html',
  'accessories/index.html',
  'marine/index.html',
  'family/index.html',
  'deep-pocket/index.html',
  'boarding-dorm/index.html',
  'pets/index.html',
  'rv-truck/index.html',
  'th/duvet-covers/index.html',
  'th/sheets/index.html',
  'th/protection/index.html',
  'th/pillowcases/index.html',
  'th/accessories/index.html',
  'th/marine/index.html',
  'th/family/index.html',
  'th/deep-pocket/index.html',
  'th/boarding-dorm/index.html',
  'th/pets/index.html',
  'th/rv-truck/index.html',
];

// Pattern: Video card (listing-card with card-video-badge)
var VIDEO_CARD_RE = /\s*<!-- How to Measure[^]*?-->\s*<article class="listing-card"[^]*?card-video-badge[^]*?<\/article>/;

var totalCleaned = 0;
categoryPages.forEach(function(page) {
  var f = path.join(base, page);
  if (!fs.existsSync(f)) return;
  var s = fs.readFileSync(f, 'utf8');
  var original = s;
  s = s.replace(VIDEO_CARD_RE, '');
  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    totalCleaned++;
    console.log('Removed video card: ' + page);
  }
});

console.log('\nTotal category pages cleaned: ' + totalCleaned);
console.log('Done.');
