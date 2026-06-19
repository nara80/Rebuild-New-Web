const fs = require('fs');

const csvPath = 'D:/00_mildmate/Re-Build_web/MildMateDataBase/Etsy/EtsyListingsDownload.csv';
const content = fs.readFileSync(csvPath, 'utf8');

const listings = [];
let currentField = '';
let currentRecord = [];
let inQuotes = false;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '"') {
    // Check if it's an escaped quote "" inside a quote
    if (inQuotes && content[i + 1] === '"') {
      currentField += '"';
      i++; // Skip the next quote
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
    // Ignore carriage return outside quotes
  } else {
    currentField += char;
  }
}

if (currentField || currentRecord.length > 0) {
  currentRecord.push(currentField);
  listings.push(currentRecord);
}

// First record is header
const header = listings[0];
console.log('Headers found:', header.slice(0, 5).join(', '));

const titleIndex = header.indexOf('TITLE');
console.log('Title Index:', titleIndex);

if (titleIndex !== -1) {
  console.log('\n--- LISTINGS FOUND ---');
  listings.slice(1).forEach((listing, index) => {
    console.log(`${index + 1}. ${listing[titleIndex]}`);
  });
}
