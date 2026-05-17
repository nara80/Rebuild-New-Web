var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);

dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  var buf = fs.readFileSync(f);
  
  // Find description tag bytes
  var idx = buf.indexOf('<meta name="description"');
  if (idx < 0) return;
  var end = buf.indexOf(Buffer.from('">'), idx);
  if (end < 0) return;
  var tag = buf.slice(idx, end + 2);
  
  // Check for non-ASCII bytes in description content (past 'content="')
  var contentIdx = buf.indexOf(Buffer.from('content="'), idx);
  if (contentIdx < 0) return;
  contentIdx += 10; // past content="
  var contentEnd = buf.indexOf(Buffer.from('">'), contentIdx);
  if (contentEnd < 0) return;
  var content = buf.slice(contentIdx, contentEnd);
  
  // Check if any byte >= 0x80 in description content
  var nonAscii = [];
  for (var i = 0; i < content.length; i++) {
    if (content[i] >= 0x80) {
      nonAscii.push({ pos: i, byte: content[i], triple: content.slice(i, Math.min(i+3, content.length)).toString('latin1') });
    }
  }
  
  if (nonAscii.length > 0) {
    console.log(dir + ': ' + nonAscii.length + ' non-ASCII bytes in description');
    console.log('  Content as UTF-8:', content.toString('utf8').substring(0,80));
    console.log('  Content as Latin1:', content.toString('latin1').substring(0,80));
    console.log('  First non-ASCII:', JSON.stringify(nonAscii.slice(0,3)));
  }
});
