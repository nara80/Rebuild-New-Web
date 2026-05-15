const {execSync} = require('child_process');
try {
  execSync('git commit -m "Product pages: standardize all CTAs to Customize, remove price disclaimer, center 2-product grids"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Done.');
} catch(e) { console.log(e.message); }
