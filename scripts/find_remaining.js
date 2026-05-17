var fs = require('fs');
var s = fs.readFileSync('D:/00_MildMate/Re-Build_Web/public/product/3-sided-duvet/index.html', 'utf8');
var re = /\u00C2[\u0080-\u00FF]/g;
var m;
while ((m = re.exec(s)) !== null) {
  var ctx = s.substring(Math.max(0, m.index - 30), Math.min(s.length, m.index + 30));
  console.log('Found at index ' + m.index + ': ' + JSON.stringify(m[0]) + ' = U+' + m[0].codePointAt(0).toString(16) + ' U+' + m[0].codePointAt(1).toString(16));
  console.log('Context: ' + ctx);
}
