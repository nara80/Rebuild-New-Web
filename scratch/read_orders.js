const fs = require('fs');

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = [];
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
      rows.push(currentRecord);
      currentRecord = [];
      currentField = '';
    } else if (char === '\r' && !inQuotes) {
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField);
    rows.push(currentRecord);
  }

  const header = rows[0];
  console.log(`\n--- ${filePath} ---`);
  console.log(`Total Rows: ${rows.length - 1}`);
  rows.slice(1).forEach((row, idx) => {
    // Print Order ID, Date, Value, SKU, and check if any other columns have product info
    console.log(`Order ${idx + 1}: Date=${row[0]}, ID=${row[1]}, Value=${row[16]}, SKU=${row[35] || 'N/A'}`);
  });
}

analyzeFile('D:/00_mildmate/Re-Build_web/data/EtsySoldOrders2025.csv');
analyzeFile('D:/00_mildmate/Re-Build_web/data/EtsySoldOrders2026.csv');
analyzeFile('D:/00_mildmate/Re-Build_web/MildMateDataBase/Etsy/Orders/EtsySoldOrders2026.csv');
