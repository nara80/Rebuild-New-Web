const {execSync} = require('child_process');
try {
  execSync('git add -A', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  execSync('git commit -m "Fix TH nav: all internal links now use th/ prefix; BILINGUAL_PAGES list updated"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Done.');
} catch(e) { console.log(e.message); }
