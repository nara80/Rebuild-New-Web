// QA helper: replace legacy GA4/GTM bootstrap variants with the unified loader block.
// UTF-8 in/out, no BOM. Usage: node scripts/qa-replace-analytics-bootstrap.js <file> [...]
const fs = require('fs');

const NEW_BLOCK = [
  '  <script src="/js/analytics-env.js"></script>',
  '  <script>',
  '    (function () {',
  '      function bootMildmateAnalytics() {',
  "        if (typeof window.__mildmateInitAnalytics !== 'function') return;",
  "        window.__mildmateInitAnalytics({ noscriptId: 'gtm-noscript', mobileLazy: true });",
  '      }',
  "      if (document.readyState === 'loading') {",
  "        document.addEventListener('DOMContentLoaded', bootMildmateAnalytics);",
  '      } else {',
  '        bootMildmateAnalytics();',
  '      }',
  '    })();',
  '  </script>'
].join('\n');

const VARIANTS = [
  // Variant A: RC analytics-env.js + inline resolver IIFE
  /<script src="\/js\/analytics-env\.js"><\/script>\s*<script>\s*\(function \(\) \{[\s\S]*?\}\)\(\);\s*<\/script>/,
  // Variant B: hardcoded GTM/GA4 IIFE (templates + most static pages)
  /<script>\s*\(function \(\) \{\s*var GTM_ID = 'GTM-KLJZZM9';[\s\S]*?\}\)\(\);\s*<\/script>/,
  // Variant C: legacy split gtag.js + config + GTM snippets (TH homepage style)
  /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]*"><\/script>\s*<script>[\s\S]*?<\/script>\s*<script>[\s\S]*?'GTM-KLJZZM9'\);[\s\S]*?<\/script>/
];

const NOSCRIPT_RE = /<noscript><iframe src="https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-KLJZZM9"[\s\S]*?<\/iframe><\/noscript>/;

let failed = false;
for (const file of process.argv.slice(2)) {
  const txt = fs.readFileSync(file, 'utf8');
  let out = txt;
  let hit = null;
  for (let i = 0; i < VARIANTS.length; i++) {
    const m = out.match(VARIANTS[i]);
    if (m) { hit = i; out = out.replace(VARIANTS[i], NEW_BLOCK); break; }
  }
  if (hit === null) {
    if (out.includes('analytics-env.js') && out.includes('__mildmateInitAnalytics')) {
      console.log('SKIP (already unified):', file);
    } else {
      console.error('FAIL (no variant matched):', file);
      failed = true;
    }
    continue;
  }
  out = out.replace(NOSCRIPT_RE, '<noscript id="gtm-noscript"></noscript>');
  fs.writeFileSync(file, out, 'utf8');
  console.log('OK (variant ' + hit + '):', file);
}
process.exit(failed ? 1 : 0);
