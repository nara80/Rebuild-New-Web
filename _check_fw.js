var fs = require('fs');
var base = 'D:\\00_MildMate\\Re-Build_Web';

function check(label, path) {
    var full = base + '\\' + path;
    var exists = fs.existsSync(full);
    console.log((exists ? '✓' : '✗') + ' ' + label + ': ' + path + (exists ? ' (' + fs.statSync(full).size + ' bytes)' : ' MISSING'));
}

// Static pages
[
    ['Homepage EN', 'public\\index.html'],
    ['Homepage TH', 'public\\th\\index.html'],
    ['About', 'public\\about\\index.html'],
    ['Contact', 'public\\contact\\index.html'],
    ['Fabric', 'public\\fabric\\index.html'],
    ['Size Guide EN', 'public\\sizeguide\\index.html'],
    ['Mattress-size-th (EN)', 'public\\mattress-size-th\\index.html'],
    ['How to Measure', 'public\\how-to-measure-mattress-size\\index.html'],
    ['Shipping', 'public\\shipping\\index.html'],
    ['Privacy Policy', 'public\\policy\\index.html'],
    ['Reviews', 'public\\reviews\\index.html'],
    ['Checkout', 'public\\checkout\\index.html'],
    ['Order Confirmed', 'public\\order-confirmed\\index.html'],
    ['Account', 'public\\account\\index.html'],
    ['Products listing', 'public\\products\\index.html'],
    ['Blog Index', 'public\\blogs\\index.html'],
    ['Blog template', 'public\\blogs\\template\\index.html'],
    ['Blog post sample', 'public\\blogs\\v-berth-sheets-vs-standard\\index.html'],
    ['Admin index', 'public\\admin\\index.html'],
    ['Admin sandbox', 'public\\admin\\sandbox\\index.html'],
    ['Track', 'public\\track\\index.html'],
    ['Custom measurement', 'public\\custom-measurement\\index.html'],
].forEach(function(item) { check(item[0], item[1]); });

console.log('\n--- JS files ---');
var jsFiles = ['nav.js', 'cart.js', 'clerk.js', 'geo.js', 'cookie-consent.js', 'product-configurator.js', 'product-sizes.js'];
jsFiles.forEach(function(f) { check(f, 'public\\js\\' + f); });

console.log('\n--- Workers ---');
var workers = ['products.ts', 'pricing.ts', 'geo-currency.ts', 'subscribe.ts', 'unsubscribe.ts', 'quote.ts', 'contact.ts', 'email.ts', 'checkout.ts', 'webhook.ts', 'auth.ts', 'customers.ts', 'order-confirmed.ts', 'clerk-verify.ts', 'admin-products.ts', 'admin-upload.ts', 'admin-pricing.ts', 'index.ts'];
workers.forEach(function(f) { check('workers/' + f, 'workers\\api\\' + f); });

console.log('\n--- Middleware & Functions ---');
check('middleware', 'functions\\account\\_middleware.ts');
check('quote [[path]].ts', 'functions\\quote\\[[path]].ts');
check('functions [[path]].ts', 'functions\\api\\[[path]].ts');

console.log('\n--- Root files ---');
['mockup.html', 'blog-mockup.html'].forEach(function(f) { check(f, f); });
['001_initial.sql', '002_add_tags.sql', '002_discount_claims.sql', '003_custom_quotes.sql', '003_quote_fields.sql', '003_seed_products.sql', '004_rate_limits.sql', '005_pricing_params.sql', '006_product_editor.sql', '007_seed_products.sql', '008_seed_image_urls.sql', '009_customer_addresses.sql'].forEach(function(f) { check('migration ' + f, 'migrations\\' + f); });

console.log('\n--- Blog pagination ---');
check('Blog page/2', 'public\\blogs\\page\\2\\index.html');

console.log('\n--- CSS ---');
check('main.css', 'public\\css\\main.css');
check('admin.css', 'public\\css\\admin.css');

console.log('\n--- Redirects ---');
check('_redirects', 'public\\_redirects');
check('_headers', 'public\\_headers');
check('robots.txt', 'public\\robots.txt');

console.log('\n--- Scripts ---');
check('build-products.js', 'scripts\\build-products.js');
check('build-blogs.js', 'scripts\\build-blogs.js');
