const paths = [
  // Toggle TH → EN paths (from TH pages)
  '/th/',            // TH homepage
  '/th/about/',
  '/th/sizeguide/',
  '/th/products/',
  '/th/marine/',
  '/th/fabric/',
  // Toggle EN → TH paths (from EN pages)
  '/sizeguide/',    // EN sizeguide
  '/sizeguide/th/', // TH sizeguide (toggle target)
  '/mattress-size-th/',   // WordPress old URL
  '/mattress-size/',      // WordPress old URL
  '/bed-sheets-size/',    // WordPress old URL
];

const rules = [
  { pattern: '/mattress-size-th/*',  dest: '/sizeguide/th/', type: 301 },
  { pattern: '/mattress-size/*',     dest: '/sizeguide/',     type: 301 },
  { pattern: '/bed-sheets-size/*',  dest: '/sizeguide/',     type: 301 },
];

function matches(path, pattern) {
  // Cloudflare Pages glob: pattern/* matches path if path starts with pattern
  // OR if pattern is like /foo/* and path = /foo
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2); // remove /*
    return path === prefix || path.startsWith(prefix + '/');
  }
  return path === pattern;
}

console.log('Redirect conflict analysis:\n');
for (const p of paths) {
  for (const r of rules) {
    if (matches(p, r.pattern)) {
      console.log(`CONFLICT: "${p}" matches rule "${r.pattern}" → ${r.dest}`);
    }
  }
}
console.log('\nSafe paths (no conflicts):', paths.filter(p => !rules.some(r => matches(p, r.pattern))));
