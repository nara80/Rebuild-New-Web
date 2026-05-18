const fs = require('fs');
const path = require('path');

const base = 'D:/00_MildMate/Re-Build_Web/public';

const categoryPages = [
  'sheets/index.html', 'duvet-covers/index.html', 'pillowcases/index.html',
  'protection/index.html', 'accessories/index.html', 'family/index.html',
  'pets/index.html', 'marine/index.html', 'rv-truck/index.html',
  'boarding-dorm/index.html', 'deep-pocket/index.html',
  'th/sheets/index.html', 'th/duvet-covers/index.html', 'th/pillowcases/index.html',
  'th/protection/index.html', 'th/accessories/index.html', 'th/family/index.html',
  'th/pets/index.html', 'th/marine/index.html', 'th/rv-truck/index.html',
  'th/boarding-dorm/index.html',
];

let totalMissing = 0;

categoryPages.forEach(file => {
  const filePath = path.join(base, file);
  if (!fs.existsSync(filePath)) return;
  const html = fs.readFileSync(filePath, 'utf8');
  const lang = file.startsWith('th/') ? 'TH' : 'EN';
  const page = file.replace('index.html','').replace('th/', 'th/');
  
  // Find all listing-card articles
  const cardRegex = /<article class="listing-card">[\s\S]*?<\/article>/g;
  const cards = html.match(cardRegex) || [];
  
  cards.forEach((card, i) => {
    const titleMatch = card.match(/class="card-title">([^<]+)<\/h3>/);
    const title = titleMatch ? titleMatch[1] : '(no title)';
    const hasTags = /<div class="card-tags">[\s\S]*?<\/div>/.test(card);
    const tagMatch = card.match(/<div class="card-tags">([\s\S]*?)<\/div>/);
    const tags = tagMatch ? (tagMatch[1].match(/<span class="card-tag">([^<]+)<\/span>/g) || []).map(m => m.match(/<span class="card-tag">([^<]+)<\/span>/)[1]) : [];
    
    if (!hasTags || tags.length === 0) {
      console.log('[' + lang + '] /' + page + ' — MISSING TAGS: "' + title + '"');
      totalMissing++;
    }
  });
});

if (totalMissing === 0) {
  console.log('\nALL CLEAN — Every product card has tags.');
} else {
  console.log('\nTotal missing: ' + totalMissing);
}
