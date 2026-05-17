var fs = require('fs');
var buf = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html');

// Find "Duvet Cover" and show 30 bytes after it
var idx = buf.indexOf(Buffer.from('Duvet Cover'));
if (idx < 0) { console.log('Not found'); process.exit(0); }

var slice = buf.slice(idx, idx + 40);
console.log('Bytes at "Duvet Cover" + 30:');
console.log(JSON.stringify([...slice]));
console.log('');
console.log('As UTF-8 string chars:');
var s = slice.toString('utf8');
for (var i = 0; i < s.length; i++) {
  var cp = s.charCodeAt(i);
  console.log('  [' + i + '] = U+' + cp.toString(16).padStart(4, '0') + ' (' + s[i] + ')');
}
