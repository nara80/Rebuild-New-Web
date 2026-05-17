var fs = require('fs');
var b = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html');
var s = b.toString('utf8');
var d = s.match(/<meta name="description"[^>]*>/);
if (!d) { console.log('No description found'); process.exit(0); }
d = d[0];
console.log('Description:', d.substring(0, 120));
console.log('Has baht U+0E3F:', d.includes('\u0E3F'));
console.log('Has em-dash U+2014:', d.includes('\u2014'));
console.log('Char codes at 11-14:', JSON.stringify([d.charCodeAt(11), d.charCodeAt(12), d.charCodeAt(13), d.charCodeAt(14)]));
// Show what those characters are
console.log('Chars 11-14:', JSON.stringify(d.substring(11, 15)));
// Check the TH baht
var bahtPos = s.indexOf('\u0E3F');
console.log('Baht at:', bahtPos);
if (bahtPos > 0) {
  console.log('Context:', s.substring(bahtPos - 20, bahtPos + 20));
}
