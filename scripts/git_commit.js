const {execSync} = require('child_process');
try {
  execSync('git commit -m "Create 12 Thai product/category pages with brand-hero styling"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Committed OK');
} catch(e) {
  console.log('Error:', e.message);
}
