var fs = require('fs');
var path = require('path');

// Fix double-UTF-8-encoded (mojibake) characters in HTML files.
// Pattern: original UTF-8 bytes were misread as Windows-1252 and re-encoded as UTF-8.
// Example: em-dash "—" (UTF-8: E2 80 94) -> read as Win-1252 (â € ") -> re-encoded as UTF-8 (C3 A2 E2 82 AC C2 9D)
//          Displayed in browser as: â€"

var REPLACEMENTS = [
  // Triple-byte original characters (general punctuation / currency)
  ['\u00E2\u20AC\u201D', '\u2014'],     // em dash — (E2 80 94 strict)
  ['\u00E2\u20AC\u201C', '\u2013'],     // en dash – (E2 80 93 strict)
  ['\u00E2\u20AC\u0022', '\u2014'],     // em dash — (94 decoded as ASCII ")
  ['\u00E2\u20AC\u0027', '\u2013'],     // en dash – (93 decoded as ASCII ')
  ['\u00E2\u20AC\u0153', '\u201C'],     // left double quote " (E2 80 9C)
  ['\u00E2\u20AC\u009D', '\u201D'],     // right double quote " (E2 80 9D)
  ['\u00E2\u20AC\u02DC', '\u2018'],     // left single quote ' (E2 80 98)
  ['\u00E2\u20AC\u2122', '\u2019'],     // right single quote ' (E2 80 99)
  ['\u00E2\u20AC\u00A6', '\u2026'],     // ellipsis … (E2 80 A6)
  ['\u00E2\u20AC\u00A2', '\u2022'],     // bullet • (E2 80 A2)
  ['\u00E2\u20AC\u00B0', '\u2030'],     // per mille ‰ (E2 80 B0)
  ['\u00E0\u00B8\u00BF', '\u0E3F'],     // Thai baht ฿ (E0 B8 BF)
  // Two-byte original characters (Latin-1 supplement)
  ['\u00C3\u00A9', '\u00E9'],           // é
  ['\u00C3\u00A8', '\u00E8'],           // è
  ['\u00C3\u00AA', '\u00EA'],           // ê
  ['\u00C3\u00AB', '\u00EB'],           // ë
  ['\u00C3\u00A1', '\u00E1'],           // á
  ['\u00C3\u00A0', '\u00E0'],           // à
  ['\u00C3\u00A2', '\u00E2'],           // â
  ['\u00C3\u00AD', '\u00ED'],           // í
  ['\u00C3\u00B3', '\u00F3'],           // ó
  ['\u00C3\u00B6', '\u00F6'],           // ö
  ['\u00C3\u00BC', '\u00FC'],           // ü
  ['\u00C3\u00B1', '\u00F1'],           // ñ
  ['\u00C2\u00A3', '\u00A3'],           // £
  ['\u00C2\u00B0', '\u00B0'],           // °
  ['\u00C2\u00B7', '\u00B7'],           // ·
  ['\u00C2\u00B2', '\u00B2'],           // ²
  ['\u00C2\u00B3', '\u00B3'],           // ³
  ['\u00C2\u00BD', '\u00BD'],           // ½
  ['\u00C2\u00BC', '\u00BC'],           // ¼
  ['\u00C2\u00BE', '\u00BE'],           // ¾
  ['\u00C2\u00A0', '\u00A0'],           // non-breaking space
];

function fixFile(f) {
  var s = fs.readFileSync(f, 'utf8');
  var original = s;
  var stats = {};

  // Catch-all mojibake: â€ + any char = original em-dash/en-dash/quote sequence.
  // Replace with ASCII " -- " for safe display under any charset interpretation.
  var dashRegex = /\u00E2\u20AC[\u0022\u0027\u201C\u201D\u0153\u009D\u02DC\u00A6\u00A2\u00B0\u2122]/g;
  var dashMatches = s.match(dashRegex);
  if (dashMatches) {
    stats['dash'] = dashMatches.length;
    s = s.replace(dashRegex, ' -- ');
  }

  for (var i = 0; i < REPLACEMENTS.length; i++) {
    var bad = REPLACEMENTS[i][0];
    var good = REPLACEMENTS[i][1];
    var parts = s.split(bad);
    if (parts.length > 1) {
      var key = good.codePointAt(0).toString(16);
      stats[key] = (stats[key] || 0) + (parts.length - 1);
      s = parts.join(good);
    }
  }
  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    return stats;
  }
  return null;
}

var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);
var totalFixed = 0;

dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  var stats = fixFile(f);
  if (stats) {
    totalFixed++;
    var summary = Object.keys(stats).map(function(k) { return 'U+' + k.toUpperCase() + ':' + stats[k]; }).join(', ');
    console.log('Fixed: ' + dir + ' (' + summary + ')');
  }
});

console.log('\nTotal files fixed: ' + totalFixed + ' / ' + dirs.length);
