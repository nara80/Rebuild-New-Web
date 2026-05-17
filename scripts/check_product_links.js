var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// All "View Options" -> product pages
var htmlFiles = [];
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) htmlFiles.push(f);
  });
}
walk(base);

// Extract all product page links from HTML files
var productLinks = {};
var brokenLinks = [];

htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var hrefs = s.match(/href="(\/product\/[^"#]+)"/g) || [];
  hrefs.forEach(function(h) {
    var url = h.match(/href="([^"]+)"/)[1];
    // Normalize to directory path
    var dir = url.replace(/\/$/, '');
    productLinks[url] = f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', '');
  });
});

// Check each product link against disk
console.log('=== CHECKING ALL /product/ LINKS ===\n');
var allLinks = {};
Object.keys(productLinks).forEach(function(url) {
  allLinks[url] = productLinks[url];
});

var sortedUrls = Object.keys(allLinks).sort();
var results = {};
sortedUrls.forEach(function(url) {
  var dir = url.replace(/\/$/, '');
  var diskPath = path.join(base, 'product', dir.replace('/product/', ''));
  var exists = fs.existsSync(diskPath) || fs.existsSync(diskPath + '/index.html');
  var slug = dir.replace('/product/', '');
  if (!exists) {
    console.log('BROKEN: ' + url + ' (referenced in: ' + allLinks[url] + ')');
  }
});

console.log('\nTotal product links checked: ' + sortedUrls.length);
var broken = sortedUrls.filter(function(url) {
  var diskPath = path.join(base, 'product', url.replace('/product/', '').replace(/\/$/, ''));
  return !fs.existsSync(diskPath) && !fs.existsSync(diskPath + '/index.html');
});
console.log('Broken product links: ' + broken.length);
if (broken.length === 0) console.log('All product links valid!');
