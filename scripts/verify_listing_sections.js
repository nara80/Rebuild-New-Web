var fs = require('fs');

function getListingSectionProducts(page) {
  // Extract only the listing-section main grid (between listing-section and listing-desc)
  var m = page.match(/<section class="listing-section">[\s\S]*?<div class="listing-grid">([\s\S]*?)<\/div>\s*<\/section>/);
  if (!m) return [];
  return m[1].match(/<article class="listing-card"[^>]*>[\s\S]*?<\/article>/g) || [];
}

function cardTitle(c) {
  return (c.match(/class="card-title">([^<]+)<\/h3>/) || ['',''])[1];
}
function cardPrice(c) {
  return (c.match(/class="card-price[^>]*>([^<]+)<\/div>/) || ['',''])[1].trim();
}
function cardImg(c) {
  return (c.match(/src="([^"]+\/main[^"]+)"/) || ['',''])[1];
}
function cardHref(c) {
  return (c.match(/href="(\/product\/[^"]+)"/) || ['',''])[1];
}

var filterS = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/products/index.html', 'utf8');
var filterCards = filterS.match(/<article class="product-card"[^>]*>[\s\S]*?<\/article>/g) || [];

function getFilterProducts(tag) {
  var seen = {}, r = [];
  filterCards.forEach(function(c) {
    var cats = (c.match(/data-categories="([^"]+)"/) || ['',''])[1];
    if (!cats.split(',').some(function(x){return x.trim()===tag;})) return;
    var title = (c.match(/class="product-title">([^<]+)<\/h3>/) || ['',''])[1];
    var price = (c.match(/class="product-price[^>]*>([^<]+)<\/div>/) || ['',''])[1].trim();
    var img = (c.match(/src="([^"]+\/main[^"]+)"/) || ['',''])[1];
    var href = (c.match(/href="(\/product\/[^"]+)"/) || ['',''])[1];
    var key = title+'|'+price+'|'+img;
    if (seen[key] || !title) return;
    seen[key] = 1;
    r.push({title:title, price:price, img:img, href:href});
  });
  return r;
}

var pages = {
  'family':      'D:/00_MildMate/Re-Build_Web/public/family/index.html',
  'pets':        'D:/00_MildMate/Re-Build_Web/public/pets/index.html',
  'marine':      'D:/00_MildMate/Re-Build_Web/public/marine/index.html',
  'rv-truck':   'D:/00_MildMate/Re-Build_Web/public/rv-truck/index.html',
  'boarding-dorm': 'D:/00_MildMate/Re-Build_Web/public/boarding-dorm/index.html',
  'duvet-covers': 'D:/00_MildMate/Re-Build_Web/public/duvet-covers/index.html',
};

Object.keys(pages).forEach(function(key) {
  var page = fs.readFileSync(pages[key], 'utf8');
  var listing = getListingSectionProducts(page);
  var filter = getFilterProducts(key);
  var filterSet = {};
  filter.forEach(function(f) { filterSet[f.title+f.price+f.img] = 1; });
  var ok = listing.filter(function(c) { return filterSet[cardTitle(c)+cardPrice(c)+cardImg(c)]; });
  var wrong = listing.length - ok.length;
  console.log(key + ': listing=' + listing.length + ' filter=' + filter.length + ' wrong_in_listing=' + wrong);
  if (wrong > 0) {
    listing.forEach(function(c) {
      var t = cardTitle(c), p = cardPrice(c), img = cardImg(c), href = cardHref(c);
      if (!filterSet[t+p+img]) console.log('  REMOVE: ' + t + ' | ' + p + ' | ' + img);
    });
  }
});
