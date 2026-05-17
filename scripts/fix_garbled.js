var fs = require('fs');
var path = require('path');
var http = require('http');

// Fixes for garbled chars in UTF-8 files
// These occur when characters like em dash (U+2014) are stored as garbled UTF-8 multi-byte sequences

// The garbled patterns and their correct equivalents:
var FIXES = [
  // Em dash: 0xE2 0x80 0x94 → U+2014
  [Buffer.from([0xE2,0x80,0x94]), Buffer.from([0xE2,0x80,0x94])],
  // Actually these are just plain em dashes that got corrupted
];

// Alternative: find and replace garbled sequences by looking at actual byte patterns
function findGarbledPatterns(buf) {
  var patterns = [];
  var i = 0;
  while (i < buf.length - 2) {
    var b0 = buf[i], b1 = buf[i+1], b2 = buf[i+2];
    // Check for 3-byte UTF-8 sequences that might be garbled
    if (b0 >= 0x80 && b0 <= 0xBF && b1 >= 0x80 && b1 <= 0xBF && b2 >= 0x80 && b2 <= 0xBF) {
      // Valid 3-byte UTF-8. Try to decode
      var cp = ((b0 & 0x0F) << 12) | ((b1 & 0x3F) << 6) | (b2 & 0x3F);
      // If codepoint is a control character or unusual punctuation, flag it
      if (cp >= 0x2000 && cp <= 0x206F) { // general punctuation range
        var decoded = Buffer.from([b0,b1,b2]).toString('utf8');
        if (decoded !== String.fromCodePoint(cp)) {
          patterns.push({ pos: i, bytes: [b0,b1,b2], cp: cp, decoded: decoded });
        }
      }
    }
    i++;
  }
  return patterns;
}

// Simpler approach: check for specific garbled patterns
function scanFile(f) {
  var buf = fs.readFileSync(f);
  var s = buf.toString('utf8');
  var issues = [];
  
  // Pattern: â followed by € or similar common garbled sequences
  // â€ = U+2014 (em dash) stored as Latin1 then read as UTF-8
  // â€ = E2 80 94 in UTF-8 = â€ in Latin1 interpretation of valid UTF-8
  
  // Check description and title specifically
  var desc = s.match(/<meta name="description" content="([^"]*)"/);
  var title = s.match(/<title>([^<]*)<\/title>/);
  
  if (desc) {
    var descStr = desc[1];
    if (descStr.includes('â€') || descStr.includes('Duvet Cover') && descStr.length < 10) {
      console.log(f + ': description garbled: ' + descStr.substring(0,80));
      issues.push({ type: 'description', content: descStr });
    }
  }
  if (title) {
    var titleStr = title[1];
    if (titleStr.includes('â€')) {
      console.log(f + ': title garbled: ' + titleStr);
      issues.push({ type: 'title', content: titleStr });
    }
  }
  
  // Count total garbled chars in the file
  var garbled = s.match(/[â€]/g);
  if (garbled && garbled.length > 0) {
    console.log(f + ': ' + garbled.length + ' garbled chars');
  }
  
  return issues;
}

// Also check server response
function checkServer(path) {
  return new Promise(function(resolve) {
    http.get('http://localhost:8788' + path, function(r) {
      var chunks = [];
      r.on('data', function(c) { chunks.push(c); });
      r.on('end', function() {
        var d = Buffer.concat(chunks);
        var s = d.toString('utf8');
        var desc = s.match(/<meta name="description"[^>]*>/);
        var title = s.match(/<title>[^<]*<\/title>/);
        console.log('SERVER: ' + path);
        if (desc) console.log('  Desc:', desc[0].substring(0,100));
        if (title) console.log('  Title:', title[0].substring(0,100));
        var garbled = s.match(/[â€]/g);
        console.log('  Garbled chars:', garbled ? garbled.length : 0);
        resolve();
      });
    }).on('error', function(e) { console.error(e); resolve(); });
  });
}

// Run
var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);
dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  scanFile(f);
});

console.log('\n--- Server check ---');
checkServer('/product/3-sided-duvet/');
checkServer('/product/pet-owner-fitted-sheet/');
