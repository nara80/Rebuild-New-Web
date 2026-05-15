const {execSync} = require('child_process');
try {
  execSync('git commit -m "Update AGENTS.md, Framework.md, Phase4-Task.md: Phase 9 added, all product images marked real, CTA View Options, brand-hero noted"', {cwd:'D:/00_MildMate/Re-Build_Web', stdio:'inherit'});
  console.log('Done.');
} catch(e) { console.log(e.message); }
