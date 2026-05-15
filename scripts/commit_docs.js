const {execSync} = require('child_process');
try {
  execSync('git add -A', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  execSync('git commit -m "Update Phase4.md + Phase4-Task.md: add missing Thai pages list, BILINGUAL_PAGES, nav link fix notes"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Done.');
} catch(e) { console.log(e.message); }
