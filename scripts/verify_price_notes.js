const fs = require('fs');
const path = require('path');
const base = 'D:/00_MildMate/Re-Build_Web/public';

const pages = [
  'sheets/index.html', 'duvet-covers/index.html', 'pillowcases/index.html',
  'protection/index.html', 'accessories/index.html', 'family/index.html',
  'pets/index.html', 'marine/index.html', 'rv-truck/index.html',
  'boarding-dorm/index.html', 'deep-pocket/index.html',
  'th/sheets/index.html', 'th/duvet-covers/index.html', 'th/pillowcases/index.html',
  'th/protection/index.html', 'th/accessories/index.html', 'th/family/index.html',
  'th/pets/index.html', 'th/marine/index.html', 'th/rv-truck/index.html',
  'th/boarding-dorm/index.html',
];

const notes = {};
let totalCards = 0;

pages.forEach(file => {
  const filePath = path.join(base, file);
  if (!fs.existsSync(filePath)) return;
  const html = fs.readFileSync(filePath, 'utf8');
  const lang = file.startsWith('th/') ? 'TH' : 'EN';
  const page = file.replace('index.html', '').replace('th/', 'th/');

  const cardRegex = /<article class="listing-card">[\s\S]*?<\/article>/g;
  const cards = html.match(cardRegex) || [];
  totalCards += cards.length;

  cards.forEach(card => {
    const titleMatch = card.match(/class="card-title">([^<]+)<\/h3>/);
    const title = titleMatch ? titleMatch[1] : '(no title)';
    const noteMatch = card.match(/<div class="card-price-note">([^<]*)<\/div>/);
    const note = noteMatch ? noteMatch[1].trim() : '(empty)';
    if (!notes[note]) notes[note] = [];
    notes[note].push('[' + lang + '] /' + page + '/ "' + title + '"');
  });
});

console.log('=== CARD-PRICE-NOTE VARIANTS ===');
Object.entries(notes).forEach(([note, occurrences]) => {
  console.log('\n"' + note + '" x' + occurrences.length + ':');
  occurrences.forEach(o => console.log('  ' + o));
});

console.log('\nTotal variants: ' + Object.keys(notes).length);
console.log('Total cards: ' + totalCards);
