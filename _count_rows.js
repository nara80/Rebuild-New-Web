var fs = require('fs');
var p = fs.readFileSync('D:\\00_MildMate\\Re-Build_Web\\AGENTS.md', 'utf8');
var i = p.indexOf('### Products with Live Pricing Formula');
var j = p.indexOf('### Products NOT', i);
var block = p.substring(i, j);
var rows = block.split('\n').filter(function(l) { return l.indexOf('|') === 0 && l.indexOf('---') === -1; });
console.log('Table rows:', rows.length - 1, '(excl. header)');
rows.slice(1).forEach(function(r) {
    var cells = r.split('|').filter(Boolean);
    if (cells[1]) console.log(cells[1].trim());
});
