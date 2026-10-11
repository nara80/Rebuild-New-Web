// QA helper: scan HTML/JS files for UTF-8/cp1252 mojibake signatures.
// ASCII-only source; signatures expressed via escapes.
const fs = require('fs');
const path = require('path');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') || e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// U+00E2 followed by U+20AC ("\u00e2\u20ac") is the classic cp1252 misread
// of a UTF-8 lead byte E2 80 xx (em dash, quotes, etc).
const SIG = /\u00e2\u20ac/;
const REPL = /\u\ufffd/;

const files = walk('public', []).concat(walk('templates', []));
const bad = [];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const hits = [];
  if (SIG.test(t)) hits.push('cp1252-mojibake');
  if (REPL.test(t)) hits.push('U+FFFD');
  if (hits.length) bad.push(f + ' -> ' + hits.join(','));
}
console.log('files scanned:', files.length);
console.log(bad.length ? bad.join('\n') : 'encoding-clean');
process.exit(bad.length ? 1 : 0);
