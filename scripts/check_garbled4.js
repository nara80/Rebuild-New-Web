var fs = require('fs');
var b = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html');
var s = b.toString('utf8');

// Find the meta description tag
var tagStart = s.indexOf('<meta name="description"');
var tagEnd = s.indexOf('>', tagStart);
var tag = s.substring(tagStart, tagEnd + 1);

// Find "Duvet Cover" in the description
var pos = tag.indexOf('Duvet Cover');
var ctx = tag.substring(pos, pos + 40);

console.log('Description context:', ctx);
console.log('');
console.log('Raw bytes (UTF-8):', JSON.stringify([...Buffer.from(ctx, 'utf8')]));
console.log('As Latin1:', Buffer.from(ctx, 'utf8').toString('latin1'));
console.log('');
console.log('Char codes:', [...ctx].map(function(c){ return c.charCodeAt(0).toString(16); }).join(' '));
console.log('');
// Look for the garbled part
var garbledStart = ctx.indexOf('Cover') + 5;
var garbled = ctx.substring(garbledStart, garbledStart + 5);
console.log('After "Cover":', garbled);
console.log('Garbled bytes:', JSON.stringify([...Buffer.from(garbled, 'utf8')]));

// The actual description - check the meta tag content value
var contentStart = tag.indexOf('content="') + 10;
var contentEnd = tag.indexOf('"', contentStart);
var content = tag.substring(contentStart, contentEnd);
console.log('');
console.log('Full description content:');
console.log(content);
console.log('');
console.log('Bytes of description:');
console.log(JSON.stringify([...Buffer.from(content, 'utf8')]));
