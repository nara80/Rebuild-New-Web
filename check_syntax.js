var fs = require('fs'), vm = require('vm');
var s = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/admin/super-admin.html', 'utf8');
var re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
var m, i = 0;
while ((m = re.exec(s)) !== null) {
  i++;
  var c = m[1] || '';
  if (!c.trim()) continue;
  if (i !== 4) continue;
  var lines = c.split('\n');
  try { new vm.Script(c, { filename: 's4.js' }); } catch (e) {
    var match = e.stack.match(/s4\.js:(\d+)/);
    var lineNum = match ? parseInt(match[1]) : 1550;
    console.log('Error at JS line ' + lineNum + ': ' + e.message);
    for (var j = Math.max(0, lineNum - 3); j <= Math.min(lines.length - 1, lineNum + 3); j++) {
      console.log('  ' + j + ': ' + (lines[j] || '').substring(0, 150));
    }
  }
}
console.log('done');
