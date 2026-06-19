const fs = require('fs');

const csvPath = 'D:/00_mildmate/Re-Build_web/MildMateDataBase/Etsy/EtsyListingsDownload.csv';
const csvContent = fs.readFileSync(csvPath, 'utf8');
const listings = [];
let currentField = '';
let currentRecord = [];
let inQuotes = false;

for (let i = 0; i < csvContent.length; i++) {
  const char = csvContent[i];
  if (char === '"') {
    if (inQuotes && csvContent[i + 1] === '"') {
      currentField += '"';
      i++;
    } else {
      inQuotes = !inQuotes;
    }
  } else if (char === ',' && !inQuotes) {
    currentRecord.push(currentField);
    currentField = '';
  } else if (char === '\n' && !inQuotes) {
    currentRecord.push(currentField);
    listings.push(currentRecord);
    currentRecord = [];
    currentField = '';
  } else if (char === '\r' && !inQuotes) {
  } else {
    currentField += char;
  }
}
if (currentField || currentRecord.length > 0) {
  currentRecord.push(currentField);
  listings.push(currentRecord);
}

const header = listings[0];
const titleIndex = header.indexOf('TITLE');

const duvetCovers = [];
listings.slice(1).forEach((row, index) => {
  const title = row[titleIndex] || '';
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('duvet')) {
    duvetCovers.push({
      originalIndex: index + 1,
      title: title
    });
  }
});

console.log(`Found ${duvetCovers.length} duvet cover listings:\n`);
duvetCovers.forEach((dc, idx) => {
  console.log(`${idx + 1}. [Etsy Row ${dc.originalIndex}] ${dc.title}`);
});
