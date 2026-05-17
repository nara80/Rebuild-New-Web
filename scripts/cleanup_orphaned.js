var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// Fix broken image refs in HTML files
var FIXES = [
  // Blog post images — these reference /images/blog-*.jpg but blog images are in /images/
  // Actually blog images seem to not exist at all. Let's just remove the broken refs from templates.
  // TH homepage broken category images
  ['/images/Categories/category-duvet.jpg',   '/images/Categories/category-duvet-covers.jpg'],
  ['/images/Categories/category-ibs.jpg',      ''], // file doesn't exist — remove reference
];

var htmlFiles = [];
function walk(d) {
  fs.readdirSync(d, { withFileTypes: true }).forEach(function(e) {
    var f = path.join(d, e.name);
    if (e.isDirectory()) walk(f);
    else if (e.isFile() && f.endsWith('.html')) htmlFiles.push(f);
  });
}
walk(base);

var totalFixed = 0;
htmlFiles.forEach(function(f) {
  var s = fs.readFileSync(f, 'utf8');
  var original = s;

  // Fix TH homepage category images
  s = s.split('/images/Categories/category-duvet.jpg').join('/images/Categories/category-duvet-covers.jpg');
  s = s.split('/images/Categories/category-ibs.jpg').join('/images/Categories/category-sheets.jpg');

  // Fix blog images — the blog index uses /images/blog-*.jpg for thumbnails
  // These images don't exist. For blog index/template, replace with placeholder approach
  // or with existing product images as placeholder
  s = s.split('/images/blog-boat-bedding.jpg').join('/images/products/marine-fitted-sheet/main.jpg');
  s = s.split('/images/blog-family-co-sleep.jpg').join('/images/products/family-fitted-sheet/main.jpg');
  s = s.split('/images/blog-pet-fur.jpg').join('/images/products/pet-owner-fitted-sheet/main.jpg');
  s = s.split('/images/blog-rv-bedding.jpg').join('/images/products/rv-truck-fitted-sheet/main.jpg');
  s = s.split('/images/blog-cloudsoft-fabric.jpg').join('/images/products/flat-sheet-standard/main.jpg');
  s = s.split('/images/blog-measure-guide.jpg').join('/images/products/3-sided-duvet/main.jpg');
  s = s.split('/images/blog-sleep-tips.jpg').join('/images/products/pillowcase-envelope/main.jpg');
  s = s.split('/images/blog-diy-sheets.jpg').join('/images/products/flat-sheet-standard/main.jpg');
  s = s.split('/images/blog-premacotton.jpg').join('/images/products/flat-sheet-extra-deep-pocket/main.jpg');
  s = s.split('/images/blog-breezeplus-care.jpg').join('/images/products/pillow-protector-general/main.jpg');
  s = s.split('/images/blog-family-safety.jpg').join('/images/products/family-fitted-sheet/main-th.jpg');
  s = s.split('/images/blog-marine-humidity.jpg').join('/images/products/marine-fitted-sheet/main.jpg');
  s = s.split('/images/blog-duvet-weights.jpg').join('/images/products/duvet-insert/main.jpg');
  s = s.split('/images/blog-rv-road-trip.jpg').join('/images/products/rv-truck-fitted-sheet/main.jpg');
  s = s.split('/images/blog-eco-luxe.jpg').join('/images/products/flat-sheet-extra-deep-pocket/main.jpg');
  s = s.split('/images/blog-pet-allergies.jpg').join('/images/products/pet-proof-mattress-protector/main.jpg');
  s = s.split('/images/blog-mattress-depth.jpg').join('/images/products/deep-pocket-fitted-sheet/main.jpg');
  s = s.split('/images/avatar-team.jpg').join('/images/products/bedbridge-connector/main.jpg');

  if (s !== original) {
    fs.writeFileSync(f, s, 'utf8');
    totalFixed++;
    console.log('Fixed: ' + f.replace(/\\/g, '/').replace(base.replace(/\\/g, '/') + '/', ''));
  }
});

console.log('\nFiles fixed: ' + totalFixed);

// Now delete orphaned flat images (moved to subfolders, old flat copies remain)
var orphanedImages = [
  '/images/products/3-sided-duvet.jpg',
  '/images/products/bedbridge-connector.jpg',
  '/images/products/bedbridge-connector-th.jpg',
  '/images/products/bedbridge-connector/main-th.jpg',
  '/images/products/boat-fitted-sheet.jpg',
  '/images/products/deep-pocket-fitted-sheet.jpg',
  '/images/products/dorm-fitted-sheet.jpg',
  '/images/products/duvet-cover-dorm.jpg',
  '/images/products/duvet-cover-marine.jpg',
  '/images/products/duvet-cover-rv.jpg',
  '/images/products/duvet-insert.jpg',
  '/images/products/family-co-sleeping-solutions-th-size.jpg',
  '/images/products/family-fitted-sheet.jpg',
  '/images/products/flat-sheet-extra-deep-pocket.jpg',
  '/images/products/flat-sheet-standard.jpg',
  '/images/products/marine-fitted-sheet.jpg',
  '/images/products/mattress-encasement-general.jpg',
  '/images/products/mattress-lift-helper.jpg',
  '/images/products/mattress-protector-deep-pocket.jpg',
  '/images/products/mattress-protector-dorm.jpg',
  '/images/products/mattress-protector-family.jpg',
  '/images/products/mattress-protector-pet.jpg',
  '/images/products/mattress-protector-standard.jpg',
  '/images/products/pet-owner-duvet-cover.jpg',
  '/images/products/pet-owner-fitted-sheet.jpg',
  '/images/products/pillow-protector-general.jpg',
  '/images/products/pillowcase-envelope.jpg',
  '/images/products/pillowcase-sham.jpg',
  '/images/products/pillowcase-zipper.jpg',
  '/images/products/rv-truck-fitted-sheet.jpg',
  '/images/products/rv-truck-mattress-encasement.jpg',
  '/images/products/standard-fitted-sheet.jpg',
  '/images/about/about-hero.jpg',
];

var deleted = 0;
orphanedImages.forEach(function(img) {
  var fullPath = path.join(base, img.replace(/^\//, '').replace(/\//g, path.sep));
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
      deleted++;
      console.log('Deleted: ' + img);
    } catch(e) {
      console.log('Failed to delete: ' + img + ' - ' + e.message);
    }
  }
});

console.log('\nOrphaned images deleted: ' + deleted);
