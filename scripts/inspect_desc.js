var fs = require('fs');
var path = require('path');
var base = 'D:/00_MildMate/Re-Build_Web/public';

var pages = ['pets', 'marine', 'rv-truck', 'boarding-dorm'];

pages.forEach(function(key) {
  var s = fs.readFileSync(path.join(base, key + '/index.html'), 'utf8');
  var descPos = s.indexOf('<section class="listing-desc-section">');

  // Find the container inside desc section
  var containerInDesc = s.indexOf('<div class="container">', descPos);

  // Find all </section> in the file and their positions
  var pos = 0;
  var secEnds = [];
  while ((pos = s.indexOf('</section>', pos)) >= 0) {
    secEnds.push(pos);
    pos++;
  }
  console.log(key + ': ' + secEnds.length + ' </section> tags at: ' + secEnds.join(', '));

  // The listing-desc-section is the LAST </section> in the file
  var lastSecEnd = secEnds[secEnds.length - 1];
  var descContent = s.substring(descPos, lastSecEnd + '</section>'.length);
  var descCards = (descContent.match(/<article class="listing-card"/g) || []).length;
  var descGridCards = (descContent.match(/<div class="listing-desc-grid">/g) || []).length;
  console.log('  desc section: ' + descContent.split('\n').length + ' lines, ' + descCards + ' listing-cards, ' + descGridCards + ' listing-desc-grid');

  if (descCards > 0) {
    var cards = descContent.match(/<article class="listing-card"[\s\S]*?<\/article>/g) || [];
    cards.forEach(function(c) {
      var t = (c.match(/class="card-title">([^<]+)<\/h3>/) || ['',''])[1];
      console.log('  DESC CARD: ' + t);
    });
  }

  // Find where listing-desc-grid starts in descContent
  var gridStart = descContent.indexOf('<div class="listing-desc-grid">');
  console.log('  listing-desc-grid at position: ' + gridStart);

  // What comes before it in descContent?
  console.log('  Content before listing-desc-grid (first 100 chars):');
  console.log('  ' + JSON.stringify(descContent.substring(0, gridStart)));
});
