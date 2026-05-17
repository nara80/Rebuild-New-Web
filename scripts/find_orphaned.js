var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// ─── Step 1: Scan all images on disk ────────────────────────────────────────
var diskImages = {};

function scanDir(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) scanDir(f);
    else if (e.isFile()) {
      var rel = f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', '');
      diskImages['/' + rel] = 1;
    }
  });
}
scanDir(path.join(base, 'images'));
var allDiskImages = Object.keys(diskImages).filter(function(k) { return k.startsWith('/images/'); });
console.log('Images on disk: ' + allDiskImages.length);

// ─── Step 2: Scan all HTML files ─────────────────────────────────────────────
var htmlFiles = [];
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) htmlFiles.push(f);
  });
}
walk(base);

// Collect used image refs
var usedImages = {};
var brokenRefs = [];
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var refs = s.match(/src="([^"]+)"/g) || [];
  refs.forEach(function(ref) {
    var src = ref.match(/src="([^"]+)"/)[1];
    if (!src.startsWith('http') && !src.startsWith('data:') && src.includes('/images/')) {
      usedImages[src] = 1;
      var diskPath = path.join(base, src.replace(/^\//, '').replace(/\//g, path.sep));
      if (!fs.existsSync(diskPath)) {
        brokenRefs.push({ file: f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''), ref: src });
      }
    }
  });
});

// ─── Step 3: Find orphaned images (on disk but never referenced) ─────────────
var orphaned = allDiskImages.filter(function(img) {
  return !usedImages[img];
});

console.log('\n=== BROKEN IMAGE REFS ===');
console.log('Count: ' + brokenRefs.length);
brokenRefs.slice(0, 30).forEach(function(b) { console.log('  ' + b.file + ' => ' + b.ref); });

console.log('\n=== ORPHANED IMAGES (on disk, never referenced in any HTML) ===');
console.log('Count: ' + orphaned.length);
orphaned.forEach(function(o) { console.log('  ' + o); });

// ─── Step 4: Collect all href links ──────────────────────────────────────────
var allHrefs = {};
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var hrefs = s.match(/href="([^"#]+)"/g) || [];
  hrefs.forEach(function(h) {
    var url = h.match(/href="([^"#]+)"/)[1];
    if (!url.startsWith('http') && !url.startsWith('mailto:') && !url.startsWith('tel:') && !url.startsWith('javascript:')) {
      allHrefs[url] = 1;
    }
  });
});

// All HTML pages on disk
var allHtmlPages = {};
htmlFiles.forEach(function(f) {
  var rel = '/' + f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', '');
  rel = rel.replace(/\/index\.html$/, '/');
  allHtmlPages[rel] = 1;
  var alt = rel.replace(/\/$/, '');
  if (alt !== rel) allHtmlPages[alt] = 1;
});

// Top-level pages that may have no incoming links
var linkedPages = {};
var topLevel = ['/', '/th/', '/products/', '/about/', '/contact/', '/fabric/', '/sizeguide/', '/shipping/', '/policy/', '/reviews/', '/checkout/', '/account/', '/blogs/', '/sheets/', '/duvet-covers/', '/pillowcases/', '/protection/', '/accessories/', '/marine/', '/family/', '/deep-pocket/', '/boarding-dorm/', '/pets/', '/rv-truck/', '/mattress-size-th/', '/how-to-measure-mattress-size/', '/bed-sheets-size/'];
topLevel.forEach(function(t) { linkedPages[t] = 1; linkedPages[t.replace(/\/$/, '')] = 1; });

// Pages not linked from anywhere
var orphanedPages = Object.keys(allHtmlPages).filter(function(p) {
  var norm = p.replace(/\/$/, '');
  return !linkedPages[p] && !linkedPages[norm];
});

console.log('\n=== ORPHANED PAGES (exist, never linked from any other page) ===');
console.log('Count: ' + orphanedPages.length);
orphanedPages.forEach(function(p) { console.log('  ' + p); });

console.log('\n=== SUMMARY ===');
console.log('HTML pages: ' + htmlFiles.length);
console.log('Images: ' + allDiskImages.length);
console.log('Broken refs: ' + brokenRefs.length);
console.log('Orphaned images: ' + orphaned.length);
console.log('Orphaned pages: ' + orphanedPages.length);
