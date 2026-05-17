var fs = require('fs');
var path = require('path');

// Find all EN product pages
var base = 'D:/00_MildMate/Re-Build_Web/public/product';
var dirs = fs.readdirSync(base);
var issues = [];
var allGood = [];

dirs.forEach(function(dir) {
  var f = path.join(base, dir, 'index.html');
  if (!fs.existsSync(f)) return;
  var content = fs.readFileSync(f, 'utf8');
  
  var hasBaht = content.includes('\u0E3F');
  var hasEmDash = content.includes('\u2014');
  var hasGarbled = content.includes('\u00E2\u20AC\u009C') || content.includes('â€');
  var hasPriceDollar = (content.match(/\$[\d,]+/g) || []).length;
  
  // Check if it's using TH-style prices (baht)
  var hasTHPricing = content.includes('\u0E3F') && content.includes('฿');
  
  if (hasBaht || hasGarbled) {
    issues.push({ dir: dir, hasBaht: hasBaht, hasEmDash: hasEmDash, hasGarbled: hasGarbled, dollarCount: hasPriceDollar });
    console.log('ISSUE: ' + dir + ' - Baht:' + hasBaht + ' EmDash:' + hasEmDash + ' Garbled:' + hasGarbled + ' DollarPrices:' + hasPriceDollar);
    
    // Show first price-related line
    var lines = content.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].match(/price|฿|\$|THB|Currency/i)) {
        console.log('  Line ' + (i+1) + ':', lines[i].trim().substring(0,120));
        break;
      }
    }
  } else {
    allGood.push(dir);
  }
});

console.log('\nTotal with issues:', issues.length);
console.log('Total good:', allGood.length);
if (issues.length === 0) console.log('All EN product pages are clean!');
