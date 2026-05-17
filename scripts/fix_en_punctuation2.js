var fs = require('fs');
var path = require('path');

// Fix garbled non-ASCII chars in EN product pages
// These are UTF-8 encoded characters that were stored from Latin-1 source
// e.g. em dash (U+2014) stored as bytes [195, 162, 226, 128, 148]
// which decode as "â€" when read as UTF-8

var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);
var fixed = [];

function fixFile(f) {
  var buf = fs.readFileSync(f);
  var out = [];
  var i = 0;
  var changed = false;
  
  while (i < buf.length) {
    var b0 = buf[i];
    
    if (b0 < 128) {
      out.push(b0);
      i++;
    } else if (b0 === 0xC3 && i + 1 < buf.length) {
      // Start of garbled em-dash: C3 A2 E2 80 94
      // Also garbled en-dash: C3 A2 80 93
      // Pattern: C3 A2 = â (garbled byte for 0xC2 in Latin1)
      var b1 = buf[i + 1];
      if (b1 === 0xA2 && i + 4 < buf.length && buf[i+2] === 0xE2 && buf[i+3] === 0x80) {
        // Em dash garbled: C3 A2 E2 80 94
        var next = buf[i + 4];
        if (next === 0x94) {
          out.push(0x20, 0x2D, 0x2D, 0x20);
          changed = true;
          i += 5;
          continue;
        }
      }
      if (b1 === 0xA2 && i + 3 < buf.length && buf[i+2] === 0x80) {
        // En dash garbled: C3 A2 80 93
        var next = buf[i + 3];
        if (next === 0x93) {
          out.push(0x2D);
          changed = true;
          i += 4;
          continue;
        }
      }
      // Standalone C3 A2 without pattern - keep as is (could be part of something else)
      out.push(b0, b1);
      i += 2;
    } else if (b0 === 0xC3 && i + 1 < buf.length) {
      // C3 followed by other byte (not A2) - could be start of valid UTF-8
      var b1 = buf[i + 1];
      if (b1 >= 0x80 && b1 <= 0xBF) {
        // Valid 2-byte UTF-8 start
        var cp = ((b0 & 0x1F) << 6) | (b1 & 0x3F);
        // If cp is in Latin1 range (0x80-0xBF) it's garbled
        if (cp >= 0x80 && cp <= 0xBF) {
          out.push(0x20); // replace garbled with space
          changed = true;
        } else {
          out.push(b0, b1);
        }
        i += 2;
      } else {
        out.push(b0);
        i++;
      }
    } else if (b0 >= 0xE0 && i + 2 < buf.length) {
      // 3-byte UTF-8 sequence
      var b1 = buf[i + 1], b2 = buf[i + 2];
      if ((b1 >= 0x80 && b1 <= 0xBF) && (b2 >= 0x80 && b2 <= 0xBF)) {
        var cp = ((b0 & 0x0F) << 12) | ((b1 & 0x3F) << 6) | (b2 & 0x3F);
        if (cp === 0x2014) { out.push(0x20, 0x2D, 0x2D, 0x20); changed = true; }
        else if (cp === 0x2013) { out.push(0x2D); changed = true; }
        else if (cp === 0x201C || cp === 0x201D) { out.push(0x22); changed = true; }
        else if (cp === 0x2018 || cp === 0x2019) { out.push(0x27); changed = true; }
        else if (cp === 0x2022) { out.push(0x2A); changed = true; }
        else if (cp === 0x2026) { out.push(0x2E, 0x2E, 0x2E); changed = true; }
        else if (cp === 0x0E3F) { out.push(0x24); changed = true; }
        else { out.push(b0, b1, b2); }
        i += 3;
      } else {
        out.push(b0); i++;
      }
    } else if (b0 >= 0xF0 && i + 3 < buf.length) {
      var b1 = buf[i+1], b2 = buf[i+2], b3 = buf[i+3];
      if ((b1 >= 0x80 && b1 <= 0xBF) && (b2 >= 0x80 && b2 <= 0xBF) && (b3 >= 0x80 && b3 <= 0xBF)) {
        out.push(b0, b1, b2, b3); i += 4;
      } else { out.push(b0); i++; }
    } else {
      out.push(b0); i++;
    }
  }
  
  return changed ? Buffer.from(out) : null;
}

dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  var result = fixFile(f);
  if (result) {
    fs.writeFileSync(f, result);
    fixed.push(dir);
    console.log('Fixed: ' + dir);
  }
});

console.log('\nTotal fixed: ' + fixed.length);
if (fixed.length === 0) console.log('All clean');
