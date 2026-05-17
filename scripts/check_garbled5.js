var fs = require('fs');
var b = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html');

// Find meta description tag
var idx = b.indexOf(Buffer.from('<meta name="description"'));
if (idx < 0) { console.log('Not found'); process.exit(0); }
var endTag = b.indexOf(Buffer.from('">'), idx);
var tag = b.slice(idx, endTag + 2);

// Find content attribute
var contentIdx = b.indexOf(Buffer.from('content="'), idx) + 10;
var contentEnd = b.indexOf(Buffer.from('"'), contentIdx);
var content = b.slice(contentIdx, contentEnd);

console.log('Description content bytes:');
console.log(JSON.stringify([...content]));
console.log('As latin1:', content.toString('latin1'));
console.log('As UTF-8:', content.toString('utf8'));

// Check for the specific garbled byte sequence C3 A2 E2 80 94
for (var i = 0; i < content.length; i++) {
  if (content[i] >= 0x80) {
    var triple = content.slice(i, Math.min(i+5, content.length));
    console.log('Non-ASCII at ' + i + ': ' + JSON.stringify([...triple]) + ' = ' + triple.toString('latin1'));
  }
}
