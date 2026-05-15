const {execSync} = require('child_process');
try {
  execSync('git add -A', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  execSync('git commit -m "Clarify redirect architecture: WordPress wildcards handle all old URLs; no separate TH pages needed"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Done.');
} catch(e) { console.log(e.message); }
