var fs = require('fs');
var f = 'D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html';
var b = fs.readFileSync(f);
var s = b.toString('utf8');

// Find the description meta tag
var descMatch = s.match(/<meta name="description"[^>]*>/);
if (descMatch) {
  var desc = descMatch[0];
  console.log('Description tag:', desc);
  // Get bytes of the description content
  var start = s.indexOf('<meta name="description"');
  var end = s.indexOf('>', start);
  var tag = s.substring(start, end+1);
  console.log('Raw bytes:', JSON.stringify([...Buffer.from(tag, 'utf8')]));
  console.log('Raw latin1:', Buffer.from(tag, 'utf8').toString('latin1').substring(0,100));
  // The "Duvet Cover" part
  var dIdx = tag.indexOf('Duvet Cover');
  if (dIdx >= 0) {
    var ctx = tag.substring(dIdx, dIdx+40);
    console.log('Context around Duvet Cover:', JSON.stringify([...Buffer.from(ctx, 'utf8')]));
    console.log('As latin1:', Buffer.from(ctx, 'utf8').toString('latin1').substring(0,40));
  }
}

// Find the title tag
var titleMatch = s.match(/<title>[^<]*<\/title>/);
if (titleMatch) {
  var title = titleMatch[0];
  console.log('\nTitle tag:', title);
  var tIdx = title.indexOf('Duvet Cover');
  if (tIdx >= 0) {
    var ctx = title.substring(tIdx, tIdx+40);
    console.log('Context:', JSON.stringify([...Buffer.from(ctx, 'utf8')]));
    console.log('As latin1:', Buffer.from(ctx, 'utf8').toString('latin1').substring(0,40));
  }
}

// Check if there are any UTF-16 LE patterns (interleaved nulls)
var nulls = 0;
for (var i = 0; i < Math.min(1000, b.length); i++) {
  if (b[i] === 0) nulls++;
}
console.log('\nNull bytes in first 1000:', nulls);

// Check for any bytes >= 128 and their pairs
console.log('\nFirst 50 non-ASCII bytes:');
var count = 0;
for (var i = 0; i < b.length && count < 50; i++) {
  if (b[i] >= 128) {
    var ctx = b.slice(Math.max(0,i-2), Math.min(b.length, i+3));
    console.log('  pos', i, ':', JSON.stringify([...ctx]), 'latin1:', ctx.toString('latin1').substring(0,8));
    count++;
  }
}
