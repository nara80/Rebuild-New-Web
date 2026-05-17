var fs = require('fs');
var path = require('path');

var base = 'D:/00_MildMate/Re-Build_Web/public';

// Check for subfolders in images/products
var imgDir = path.join(base, 'images', 'products');
var entries = fs.readdirSync(imgDir, { withFileTypes: true });
var subfolders = entries.filter(function(e) { return e.isDirectory(); });
console.log('Subfolders in images/products:', subfolders.length);
subfolders.forEach(function(e) { console.log('  ' + e.name); });

// Check structure consistency: each product should have images in its own folder?
var productDir = path.join(base, 'product');
var productSlugs = fs.readdirSync(productDir);
console.log('\nProduct folders:', productSlugs.length);
console.log('\nProduct images (flat):', fs.readdirSync(imgDir).filter(function(n) { return n.endsWith('.jpg'); }).length);

// List current images
console.log('\nCurrent images in images/products/:');
var images = fs.readdirSync(imgDir).filter(function(n) { return n.endsWith('.jpg'); }).sort();
images.forEach(function(n) { console.log('  ' + n); });

// Check if any product has images in a subfolder
var imagesWithSubfolders = [];
productSlugs.forEach(function(slug) {
  var slugImgDir = path.join(imgDir, slug);
  if (fs.existsSync(slugImgDir)) {
    var imgs = fs.readdirSync(slugImgDir).filter(function(n) { return n.endsWith('.jpg'); });
    if (imgs.length > 0) {
      imagesWithSubfolders.push({ slug: slug, imgs: imgs });
    }
  }
});
if (imagesWithSubfolders.length > 0) {
  console.log('\nProducts with image subfolders:');
  imagesWithSubfolders.forEach(function(p) {
    console.log('  ' + p.slug + '/: ' + p.imgs.join(', '));
  });
} else {
  console.log('\nNo product image subfolders exist. All images are flat in images/products/.');
}
