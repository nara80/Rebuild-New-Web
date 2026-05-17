var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);
var allClean = true;

// Common mojibake markers
var markers = [
  { name: 'â€ (em/en dash)', re: /\u00E2\u20AC/g },
  { name: 'à¸¿ (THB mojibake)', re: /\u00E0\u00B8\u00BF/g },
  { name: 'Â (Latin-1 leftover)', re: /\u00C2[\u0080-\u00FF]/g },
  { name: 'Ã (Latin-1 leftover)', re: /\u00C3[\u0080-\u00FF]/g },
];

dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  var s = fs.readFileSync(f, 'utf8');
  var problems = [];
  markers.forEach(function(m) {
    var matches = s.match(m.re);
    if (matches) {
      problems.push(m.name + '×' + matches.length);
    }
  });
  if (problems.length > 0) {
    console.log(dir + ': ' + problems.join(', '));
    allClean = false;
  }
});

if (allClean) {
  console.log('All 27 EN product pages are clean. No mojibake detected.');
}
