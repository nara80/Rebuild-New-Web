const {execSync} = require('child_process');
try {
  execSync('git add -A', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  execSync('git commit -m "Create th/shipping/ and th/policy/ Thai pages; fix unsubscribe link"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Done.');
} catch(e) { console.log(e.message); }
