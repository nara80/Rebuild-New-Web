var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);
var fixed = 0;

function fixBytes(buf) {
  var out = [];
  var i = 0;
  var changed = false;
  
  while (i < buf.length) {
    var b = buf[i];
    
    if (b < 128) {
      out.push(b);
      i++;
    } else if (b === 0xC3 && i + 1 < buf.length) {
      var b1 = buf[i+1];
      if (b1 === 0xA2 && i + 4 < buf.length) {
        var b2 = buf[i+2], b3 = buf[i+3], b4 = buf[i+4];
        if (b2 >= 0x80 && b3 >= 0x80 && b4 >= 0x80) {
          // Garbled em-dash: C3 A2 E2 XX YY (5 bytes)
          out.push(0x20, 0x2D, 0x2D, 0x20);
          changed = true;
          i += 5;
          continue;
        }
      }
      // Other C3 byte - pass through
      out.push(b, b1);
      i += 2;
    } else if (b >= 0xC0 && b <= 0xDF && i + 1 < buf.length) {
      var b1 = buf[i+1];
      if (b1 >= 0x80 && b1 <= 0xBF) {
        var cp = ((b & 0x1F) << 6) | (b1 & 0x3F);
        if (cp >= 0x00C0 && cp <= 0x00DF) {
          out.push(0x20); changed = true;
        } else {
          out.push(b, b1);
        }
        i += 2;
      } else {
        out.push(b); i++;
      }
    } else if (b >= 0xE0 && i + 2 < buf.length) {
      var b1 = buf[i+1], b2 = buf[i+2];
      if ((b1 >= 0x80 && b1 <= 0xBF) && (b2 >= 0x80 && b2 <= 0xBF)) {
        var cp = ((b & 0x0F) << 12) | ((b1 & 0x3F) << 6) | (b2 & 0x3F);
        if (cp === 0x2014 || cp === 0x2013) { out.push(0x20, 0x2D, 0x2D, 0x20); changed = true; }
        else if (cp === 0x201C || cp === 0x201D) { out.push(0x22); changed = true; }
        else if (cp === 0x2018 || cp === 0x2019) { out.push(0x27); changed = true; }
        else if (cp === 0x2026) { out.push(0x2E, 0x2E, 0x2E); changed = true; }
        else if (cp >= 0xD800) { out.push(b, b1, b2); }
        else { out.push(b, b1, b2); }
        i += 3;
      } else {
        out.push(b); i++;
      }
    } else if (b >= 0xF0 && i + 3 < buf.length) {
      var b1 = buf[i+1], b2 = buf[i+2], b3 = buf[i+3];
      if ((b1 >= 0x80 && b1 <= 0xBF) && (b2 >= 0x80 && b2 <= 0xBF) && (b3 >= 0x80 && b3 <= 0xBF)) {
        out.push(b, b1, b2, b3); i += 4;
      } else { out.push(b); i++; }
    } else {
      out.push(b); i++;
    }
  }
  
  return changed ? Buffer.from(out) : null;
}

dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  var buf = fs.readFileSync(f);
  var result = fixBytes(buf);
  if (result) {
    fs.writeFileSync(f, result);
    fixed++;
    console.log('Fixed: ' + dir);
  }
});

console.log('\nTotal: ' + fixed + ' files fixed');
