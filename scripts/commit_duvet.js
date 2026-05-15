const {execSync} = require('child_process');
try {
  execSync('git add -A', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  execSync('git commit -m "Shorten duvet cover URL: /3-sided-duvet/ replaces /3-sided-zipper-duvet-cover-for-people-who-sleep-with-pets/; 301 redirect added; image renamed; all internal links updated"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Done.');
} catch(e) { console.log(e.message); }
