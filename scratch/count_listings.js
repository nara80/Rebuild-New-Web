const fs = require('fs');
const path = require('path');

const csvPath = 'D:/00_mildmate/Re-Build_web/MildMateDataBase/Etsy/EtsyListingsDownload.csv';
const content = fs.readFileSync(csvPath, 'utf8');

let rows = 0;
let inQuotes = false;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '"') {
    inQuotes = !inQuotes;
  } else if (char === '\n' && !inQuotes) {
    rows++;
  }
}

if (content.length > 0 && content[content.length - 1] !== '\n') {
  rows++;
}

console.log('Total CSV lines (including headers):', content.split('\n').length);
console.log('Total parsed listings (excluding header):', rows - 1);
