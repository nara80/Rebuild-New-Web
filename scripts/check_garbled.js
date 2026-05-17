var fs = require('fs');
var f = 'D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html';
var b = fs.readFileSync(f);
var s = b.toString('utf8');

// Check for garbled chars that appear when UTF-8 is read as Latin1
// Pattern: bytes 0xC3 0xA2 (â), 0xE2 0x80 (€), etc.
var garbled = [];
// Find positions of garbled bytes
for (var i = 0; i < s.length; i++) {
  var c = s.charCodeAt(i);
  if (c >= 0xC0 && c <= 0xDF) { // ASCII-as-Latin1 high byte
    garbled.push({ char: s[i], code: c.toString(16), pos: i });
  }
}
console.log('Garbled chars found:', garbled.length);
if (garbled.length > 0) {
  console.log('Sample:', garbled.slice(0, 5).map(function(x){ return x.char+' U+'+x.code+' at '+x.pos; }).join(', '));
  // Show context around first garbled
  var pos = garbled[0].pos;
  console.log('Context:', s.substring(Math.max(0,pos-20), pos+20));
}

// Check what the actual bytes are
var firstGarbled = null;
for (var i = 0; i < b.length; i++) {
  if (b[i] >= 0x80 && b[i] <= 0xBF) {
    firstGarbled = i;
    break;
  }
}
if (firstGarbled !== null) {
  console.log('First non-ASCII byte at:', firstGarbled, 'value:', b[firstGarbled]);
  var ctx = b.slice(Math.max(0,firstGarbled-10), firstGarbled+20);
  console.log('Context bytes:', JSON.stringify([...ctx]));
  console.log('Context as latin1:', ctx.toString('latin1').substring(0,30));
  console.log('Context as UTF-8:', ctx.toString('utf8').substring(0,30));
}

// Also check if the file has real Thai baht
var bahtCount = (s.match(/\u0E3F/g) || []).length;
console.log('\nBaht (THB symbol U+0E3F):', bahtCount);

// Check for THB price display
var thbMatch = s.match(/[^\x00-\x7F]{3,}/g);
console.log('Non-ASCII text chunks:', thbMatch ? thbMatch.slice(0,5).join(', ') : 'none');

// Check specific garbled strings
console.log('\nHas "Duvet Cover":', s.includes('Duvet Cover'));
console.log('Has "â€":', s.includes('\u00E2\u20AC\u009C'));
console.log('Has em dash (U+2014):', s.includes('\u2014'));
console.log('Has TH baht:', s.includes('\u0E3F'));

// Show first 500 chars of body text
var bodyStart = s.indexOf('<body');
console.log('\nFirst 500 chars after body:', s.substring(bodyStart, bodyStart+500));
