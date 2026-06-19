const fs = require('fs');
const path = require('path');

// Load environment variables from scratch/.notion.env
const envPath = path.join(__dirname, '.notion.env');
if (!fs.existsSync(envPath)) {
  console.error(`Error: Environment file not found at ${envPath}`);
  console.error('Please create this file and add:');
  console.error('NOTION_TOKEN=secret_your_token_here');
  console.error('NOTION_DATABASE_ID=your_database_id_here');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.trim().split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    env[key] = val;
  }
});

const token = env.NOTION_TOKEN;
const databaseId = env.NOTION_DATABASE_ID;

if (!token || !databaseId) {
  console.error('Error: NOTION_TOKEN or NOTION_DATABASE_ID is missing in scratch/.notion.env');
  process.exit(1);
}

// 1. Parse Etsy CSV
const csvPath = 'D:/00_mildmate/Re-Build_web/MildMateDataBase/Etsy/EtsyListingsDownload.csv';
if (!fs.existsSync(csvPath)) {
  console.error(`Error: Etsy CSV not found at ${csvPath}`);
  process.exit(1);
}

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
    // skip
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
const descIndex = header.indexOf('DESCRIPTION');
const priceIndex = header.indexOf('PRICE');
const tagsIndex = header.indexOf('TAGS');
const skuIndex = header.indexOf('SKU');

const itemsToSync = listings.slice(1).map(row => {
  return {
    title: row[titleIndex] || '',
    description: row[descIndex] || '',
    price: row[priceIndex] || '0',
    tags: row[tagsIndex] ? row[tagsIndex].split(',').map(t => t.trim()).filter(Boolean) : [],
    sku: skuIndex !== -1 ? row[skuIndex] || '' : ''
  };
});

// 2. Add the 34th Listing: RV & Truck Fitted Sheet
itemsToSync.push({
  title: 'Custom Fitted Sheets for Semi Truck Sleeper Cab - Fits Kenworth Peterbilt Freightliner Volvo | Custom Any Size',
  description: `Premium custom-made fitted sheets specifically tailored for semi-truck sleeper cabs and RVs. Heavy-duty 360-degree elastic system keeps sheets firmly anchored even on moving bunks. Direct-from-manufacturer premium quality.

Fits standard and custom bunk sizes:
- 32" x 80" (Freightliner Cascadia/Coronado)
- 35" x 79" (International/Mack)
- 38" x 80" (Volvo VNL/Kenworth T680)
- 42" x 80" (Extra Wide Cabs)
- Any other custom measurements!

Available in breathable PremaCotton or cooling BreezePlus fabrics. Dirt-hiding colors like Charcoal Grey, Navy Blue, and Chocolate Brown. Handcrafted to order.`,
  price: '65',
  tags: ['semi truck sheets', 'sleeper cab bedding', 'Freightliner sheets', 'Kenworth bunk bed', 'RV fitted sheet', 'custom truck bedding', 'Volvo VNL bedding'],
  sku: 'rv-truck-fitted-sheet'
});

console.log(`Prepared ${itemsToSync.length} items to sync to Notion.`);

// Helper function to query Notion API
async function notionRequest(endpoint, method = 'GET', body = null) {
  const url = `https://api.notion.com/v1${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Notion API error (${res.status}): ${errorText}`);
  }
  return res.json();
}

// Map data based on target database properties
function buildNotionProperties(item, schemaProperties) {
  const props = {};
  const today = new Date().toISOString().split('T')[0];

  // Helper to safely truncate text for Notion (max 2000 chars per text block)
  const cleanText = (str) => (str || '').substring(0, 2000);

  // Helper to extract clean product name (Product Type - Fabric)
  const getProductName = (title) => {
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
  };


  // Iterate over existing database columns and map our data
  for (const [colName, colMeta] of Object.entries(schemaProperties)) {
    const normName = colName.toLowerCase().replace(/[\s_]/g, '');

    if (normName === 'productname' && colMeta.type === 'title') {
      props[colName] = {
        title: [{ text: { content: getProductName(item.title) } }]
      };
    } else if (normName === 'etsytitle' && colMeta.type === 'rich_text') {
      props[colName] = {
        rich_text: [{ text: { content: cleanText(item.title) } }]
      };
    } else if (normName === 'etsydescription' && colMeta.type === 'rich_text') {
      props[colName] = {
        rich_text: [{ text: { content: cleanText(item.description) } }]
      };
    } else if (normName === 'latestupdate' || normName === 'etsylastupdated' || normName === 'lastupdated') {
      if (colMeta.type === 'date') {
        props[colName] = { date: { start: today } };
      } else if (colMeta.type === 'rich_text') {
        props[colName] = { rich_text: [{ text: { content: today } }] };
      }
    } else if (normName === 'etsytags') {
      if (colMeta.type === 'multi_select') {
        const formattedTags = item.tags
          .map(t => t.replace(/,/g, '').substring(0, 100).trim())
          .filter(Boolean)
          .map(t => ({ name: t }));
        props[colName] = { multi_select: formattedTags.slice(0, 100) };
      } else if (colMeta.type === 'rich_text') {
        props[colName] = { rich_text: [{ text: { content: cleanText(item.tags.join(', ')) } }] };
      }
    } else if (normName === 'price' || normName === 'etsyprice') {
      if (colMeta.type === 'number') {
        props[colName] = { number: parseFloat(item.price) || 0 };
      } else if (colMeta.type === 'rich_text') {
        props[colName] = { rich_text: [{ text: { content: item.price } }] };
      }
    } else if (normName === 'sku' || normName === 'etsysku') {
      if (colMeta.type === 'rich_text') {
        props[colName] = { rich_text: [{ text: { content: cleanText(item.sku) } }] };
      } else if (colMeta.type === 'select') {
        props[colName] = item.sku ? { select: { name: cleanText(item.sku).substring(0, 100) } } : null;
      }
    }
  }

  return props;
}

async function sync() {
  try {
    console.log('Retrieving database schema from Notion...');
    const dbInfo = await notionRequest(`/databases/${databaseId}`);
    console.log(`Successfully connected to Database: "${dbInfo.title[0]?.plain_text || 'Untitled'}"`);

    const schemaProperties = dbInfo.properties;
    console.log('Detected database properties:', Object.keys(schemaProperties).join(', '));

    console.log('Querying existing records from Notion database...');
    let existingPages = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const queryResult = await notionRequest(`/databases/${databaseId}/query`, 'POST', {
        start_cursor: startCursor,
        page_size: 100
      });
      existingPages = existingPages.concat(queryResult.results);
      hasMore = queryResult.has_more;
      startCursor = queryResult.next_cursor;
    }

    console.log(`Found ${existingPages.length} existing records in Notion.`);

    // Build a lookup map of existing records by Etsy Title (normed)
    const pageMap = new Map();
    
    // Find the actual name of the "Etsy Title" column (case insensitive)
    let etsyTitleCol = null;
    let productNameCol = null;
    for (const key of Object.keys(schemaProperties)) {
      const norm = key.toLowerCase().replace(/[\s_]/g, '');
      if (norm === 'etsytitle') etsyTitleCol = key;
      if (norm === 'productname') productNameCol = key;
    }

    existingPages.forEach(page => {
      let titleVal = '';
      if (etsyTitleCol && page.properties[etsyTitleCol]?.rich_text) {
        titleVal = page.properties[etsyTitleCol].rich_text.map(t => t.plain_text).join('').trim();
      } else if (productNameCol && page.properties[productNameCol]?.title) {
        titleVal = page.properties[productNameCol].title.map(t => t.plain_text).join('').trim();
      }
      if (titleVal) {
        pageMap.set(titleVal.toLowerCase().trim(), page.id);
      }
    });

    let createdCount = 0;
    let updatedCount = 0;

    for (let index = 0; index < itemsToSync.length; index++) {
      const item = itemsToSync[index];
      const matchKey = item.title.toLowerCase().trim();
      const existingPageId = pageMap.get(matchKey);

      const properties = buildNotionProperties(item, schemaProperties);

      if (existingPageId) {
        // Update existing page
        await notionRequest(`/pages/${existingPageId}`, 'PATCH', { properties });
        updatedCount++;
        console.log(`[${index + 1}/${itemsToSync.length}] Updated: "${item.title.substring(0, 40)}..."`);
      } else {
        // Create new page
        await notionRequest('/pages', 'POST', {
          parent: { database_id: databaseId },
          properties
        });
        createdCount++;
        console.log(`[${index + 1}/${itemsToSync.length}] Created: "${item.title.substring(0, 40)}..."`);
      }

      // Add a small delay to avoid hitting rate limits (Notion recommends 3 requests per second)
      await new Promise(resolve => setTimeout(resolve, 350));
    }

    console.log('\n--- SYNC COMPLETE ---');
    console.log(`Total listings processed: ${itemsToSync.length}`);
    console.log(`Created: ${createdCount}`);
    console.log(`Updated: ${updatedCount}`);

  } catch (error) {
    console.error('Sync failed:', error.message);
  }
}

sync();
