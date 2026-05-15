const fs = require('fs');
const c = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/_redirects', 'utf8');
const lines = c.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));

function globMatch(path, pattern) {
  // Cloudflare Pages: pattern/* matches pattern/ AND pattern/anything
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return path === prefix || path.startsWith(prefix + '/');
  }
  return path === pattern;
}

const tests = [
  '/sizeguide/',
  '/sizeguide/th/',
  '/sizeguide/th/old-blog-post/',
  '/mattress-size/',
  '/mattress-size/old-post/',
  '/mattress-size-th/',
  '/mattress-size-th/old-post/',
  '/bed-sheets-size/',
  '/bed-sheets-size/old-post/',
  '/product/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets/',
  '/product/3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets/old-post/',
];

console.log('Redirect analysis:\n');
for (const t of tests) {
  let hit = null;
  for (const l of lines) {
    const parts = l.trim().split(/\s+/);
    if (parts.length >= 3) {
      const pattern = parts[0];
      const dest = parts[2];
      if (globMatch(t, pattern)) {
        hit = dest;
        break;
      }
    }
  }
  const status = hit ? 'REDIRECTS  → ' + hit : 'no-redirect     ';
  console.log(status + '  ←  ' + t);
}
