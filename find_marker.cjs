const fs = require('fs');
const content = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/admin/blog.html', 'utf8');
const marker = 'Signing in';
const idx = content.indexOf(marker);
if (idx < 0) { console.log('NOT FOUND'); process.exit(1); }
console.log('Found at', idx);
// Print context
console.log(JSON.stringify(content.substring(idx - 300, idx + 500)));
