var fs = require('fs');
var f = 'D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html';
var b = fs.readFileSync(f);
var s = b.toString('utf8');

// Find garbled sequences: â, €,  related bytes
var pos = 23587; // from earlier check
console.log('Around pos 23587:');
console.log('Bytes:', JSON.stringify([...b.slice(pos-10, pos+20)]));
console.log('As latin1:', b.slice(pos-10, pos+20).toString('latin1'));
console.log('As UTF-8:', b.slice(pos-10, pos+20).toString('utf8'));

// Find actual garbled em dashes
var emDashPos = s.indexOf('\u2014');
console.log('\nFirst em dash at:', emDashPos);
if (emDashPos > 0) {
  var ctx = b.slice(Math.max(0,emDashPos*2-20), emDashPos*2+20);
  console.log('Raw bytes around:', JSON.stringify([...ctx]));
}

// Check byte 25033 area
pos = 25033;
console.log('\nAround pos 25033:');
console.log('Bytes:', JSON.stringify([...b.slice(pos-10, pos+20)]));
console.log('As latin1:', b.slice(pos-10, pos+20).toString('latin1'));
console.log('As UTF-8:', b.slice(pos-10, pos+20).toString('utf8'));

// Show what the server actually serves
var http = require('http');
var req = http.get('http://localhost:8788/product/3-sided-duvet/', function(res) {
  var chunks = [];
  res.on('data', function(c) { chunks.push(c); });
  res.on('end', function() {
    var d = Buffer.concat(chunks);
    console.log('\nServer response:');
    console.log('Bytes:', d.length);
    console.log('First 20:', JSON.stringify([...d.slice(0,20)]));
    var ts = d.toString('utf8');
    console.log('Has ฿ (THB):', ts.includes('\u0E3F'));
    console.log('Has em dash U+2014:', ts.includes('\u2014'));
    console.log('Has garbled â€:', ts.includes('\u00E2\u20AC\u009C'));
    console.log('Description:', ts.match(/<meta name="description"[^>]*>/)[0].substring(0,80));
    console.log('Title:', ts.match(/<title>[^<]*<\/title>/)[0].substring(0,80));
  });
});
req.on('error', function(e) { console.error(e); });
