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
    if (inQuotes && content[i + 1] === '"') {
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
const skuIndex = header.indexOf('SKU');
console.log('SKU header index:', skuIndex);

listings.slice(1, 10).forEach((listing, index) => {
  console.log(`${index + 1}. Title: ${listing[0].substring(0, 30)}... | SKU: ${listing[skuIndex] || 'N/A'}`);
});
