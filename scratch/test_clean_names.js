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

const titles = listings.slice(1).map(row => row[titleIndex] || '');
// Add the 34th listing
titles.push('Custom Fitted Sheets for Semi Truck Sleeper Cab - Fits Kenworth Peterbilt Freightliner Volvo | Custom Any Size');

function getCleanName(title) {
  const lowerTitle = title.toLowerCase();
  
  // 1. Detect Product Type based on exact brand taxonomy
  let type = '';
  if (lowerTitle.includes('bedbridge') || lowerTitle.includes('bed bridge')) {
    type = 'BedBridge Connector';
  } else if (lowerTitle.includes('mattress lifter') || lowerTitle.includes('mattress lift')) {
    type = 'Mattress Lifter';
  } else if (lowerTitle.includes('duvet insert')) {
    type = 'Duvet Insert';
  } else if (lowerTitle.includes('duvet cover') || lowerTitle.includes('duvet')) {
    if (lowerTitle.includes('weighted blanket')) {
      type = 'Weighted Duvet Cover';
    } else if (lowerTitle.includes('marine')) {
      type = 'Marine Duvet Cover';
    } else if (lowerTitle.includes('rv') || lowerTitle.includes('truck')) {
      type = 'RV Duvet Cover';
    } else if (lowerTitle.includes('dorm')) {
      type = 'Dorm Duvet Cover';
    } else if (lowerTitle.includes('3-sided') || lowerTitle.includes('3 sides')) {
      type = '3-Sided Zipper Duvet Cover';
    } else if (lowerTitle.includes('pet')) {
      type = 'Pet Owner Duvet Cover';
    } else {
      type = 'Duvet Cover';
    }
  } else if (lowerTitle.includes('encasement')) {
    if (lowerTitle.includes('rv') || lowerTitle.includes('truck')) {
      type = 'RV & Truck Mattress Encasement';
    } else {
      type = '6-Sided Mattress Encasement';
    }
  } else if (lowerTitle.includes('pillow protector')) {
    type = 'Pillow Protector';
  } else if (lowerTitle.includes('mattress protector') || lowerTitle.includes('mattress cover') || lowerTitle.includes('bed cover')) {
    if (lowerTitle.includes('family')) {
      type = 'Family Mattress Protector';
    } else if (lowerTitle.includes('deep pocket')) {
      type = 'Deep Pocket Mattress Protector';
    } else if (lowerTitle.includes('pet-proof') || lowerTitle.includes('pet-friendly') || lowerTitle.includes('spill-resistant')) {
      type = 'Pet-Proof Mattress Protector';
    } else {
      type = 'Standard Mattress Protector';
    }
  } else if (lowerTitle.includes('pillowcase') || lowerTitle.includes('pillow cases') || lowerTitle.includes('pillow case')) {
    type = 'Pillowcase';
  } else if (lowerTitle.includes('flat sheet') || lowerTitle.includes('top sheet')) {
    if (lowerTitle.includes('family') || lowerTitle.includes('co-sleeping')) {
      type = 'Family Flat Sheet';
    } else {
      type = 'Standard Flat Sheet';
    }
  } else if (lowerTitle.includes('fitted sheet') || lowerTitle.includes('fitted sheets') || lowerTitle.includes('co-sleeping sheet') || lowerTitle.includes('bed sheet')) {
    if (lowerTitle.includes('marine') || lowerTitle.includes('boat') || lowerTitle.includes('yacht')) {
      type = 'Marine Fitted Sheet';
    } else if (lowerTitle.includes('rv') || lowerTitle.includes('truck') || lowerTitle.includes('sleeper cab')) {
      type = 'RV & Truck Fitted Sheet';
    } else if (lowerTitle.includes('dorm')) {
      type = 'Dorm Fitted Sheet';
    } else if (lowerTitle.includes('family') || lowerTitle.includes('co-sleeping') || lowerTitle.includes('giant')) {
      type = 'Family Fitted Sheet';
    } else if (lowerTitle.includes('pet')) {
      type = 'Pet Owner Fitted Sheet';
    } else if (lowerTitle.includes('deep pocket') || lowerTitle.includes('deep-pocket')) {
      type = 'Deep Pocket Fitted Sheet';
    } else {
      type = 'Standard Fitted Sheet';
    }
  } else if (lowerTitle.includes('blueprint') || lowerTitle.includes('pattern')) {
    type = 'Marine Measurement Blueprint';
  } else {
    // Fallback using split by main delimiters (ignoring hyphens inside words like co-sleep)
    const parts = title.split(/\s*\|\s*|\s*:\s*|\s+-\s+/);
    type = parts[0].trim();
  }

  // 2. Detect Fabric
  let fabric = '';
  if (lowerTitle.includes('premacotton')) {
    fabric = 'PremaCotton';
  } else if (lowerTitle.includes('ecoluxe')) {
    fabric = 'EcoLuxe';
  } else if (lowerTitle.includes('cloudsoft')) {
    fabric = 'CloudSoft';
  } else if (lowerTitle.includes('breezeplus')) {
    fabric = 'BreezePlus';
  } else if (lowerTitle.includes('organic')) {
    fabric = 'EcoLuxe';
  } else if (lowerTitle.includes('cotton')) {
    fabric = 'PremaCotton';
  } else if (lowerTitle.includes('microfiber')) {
    fabric = 'CloudSoft';
  }

  // 3. Assemble Name
  if (fabric && type && !type.includes(fabric)) {
    return `${type} - ${fabric}`;
  }
  return type;
}

titles.forEach((title, index) => {
  console.log(`${index + 1}. Original: ${title.substring(0, 50)}...`);
  console.log(`   Cleaned:  ${getCleanName(title)}`);
});
