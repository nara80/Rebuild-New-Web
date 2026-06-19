const fs = require('fs');
const path = require('path');

const rootDir = 'D:/00_mildmate/Re-Build_web';
const fileName = 'Marketplace_Strategy_2026.md';
const sourcePath = path.join(rootDir, 'MildMateDataBase', fileName);

if (!fs.existsSync(sourcePath)) {
  console.error(`Source file not found at: ${sourcePath}`);
  process.exit(1);
}

// Recursive search function to find target folder
function findFolder(dir, targetName) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file.toLowerCase() === targetName.toLowerCase() || file.toLowerCase() === 'optimizeetsylisting') {
        return fullPath;
      }
      const found = findFolder(fullPath, targetName);
      if (found) return found;
    }
  }
  return null;
}

console.log('Searching for target folder...');
let targetFolder = findFolder(rootDir, 'OptimizeEtsyLising');

if (targetFolder) {
  console.log(`Found target folder at: ${targetFolder}`);
} else {
  // Create default folder under MildMateDataBase/Etsy
  targetFolder = path.join(rootDir, 'MildMateDataBase', 'Etsy', 'OptimizeEtsyLising');
  console.log(`Folder not found. Creating new folder at: ${targetFolder}`);
  fs.mkdirSync(targetFolder, { recursive: true });
}

const destinationPath = path.join(targetFolder, fileName);
fs.renameSync(sourcePath, destinationPath);
console.log(`Successfully moved ${fileName} to ${destinationPath}`);
