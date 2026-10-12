// Injects a layout probe into the growth-card harness and captures
// headless-Chrome DOM dumps at desktop + narrow widths. The probe measures
// REAL browser geometry: adjacent-cell overlap, scroll containment,
// disclosure count, and column count — serialized into the dumped DOM.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const base = readFileSync(dir + "growth-harness.html", "utf8");

const probe = `<script>
setTimeout(function () {
  try {
    var wrap = document.querySelector('#growth-signals-table').closest('.table-wrap');
    var tds = document.querySelectorAll('#growth-signals-table tbody td');
    var overlaps = 0;
    var rowCount = document.querySelectorAll('#growth-signals-table tbody tr').length;
    var colCount = document.querySelectorAll('#growth-signals-table thead th').length;
    var detailsCount = document.querySelectorAll('#growth-signals-table details').length;
    for (var r = 0; r < rowCount; r++) {
      var cells = Array.prototype.slice.call(tds).slice(r * colCount, (r + 1) * colCount);
      for (var c = 0; c < cells.length - 1; c++) {
        var a = cells[c].getBoundingClientRect(), b = cells[c + 1].getBoundingClientRect();
        if (a.right > b.left + 1 && Math.abs(a.top - b.top) < 5) overlaps++;
      }
    }
    var probe = {
      viewport: window.innerWidth,
      rows: rowCount,
      columns: colCount,
      cell_overlaps: overlaps,
      scroll_contained: wrap.scrollWidth >= wrap.clientWidth,
      details_count: detailsCount,
      table_width_exceeds_wrap: wrap.scrollWidth > wrap.clientWidth,
      nowrap_cells: Array.prototype.some.call(tds, function (td) { return getComputedStyle(td).whiteSpace === 'nowrap'; }),
      squeezed_json_cols: Array.prototype.filter.call(tds, function (td) {
        return td.className.indexOf('wrap-json') > -1 && td.getBoundingClientRect().width < 200;
      }).length,
      anywhere_wrap_css: Array.prototype.some.call(tds, function (td) {
        return getComputedStyle(td).overflowWrap === 'anywhere' || getComputedStyle(td).wordBreak === 'break-all';
      })
    };
    var pre = document.createElement('pre');
    pre.id = 'layout-probe';
    pre.textContent = 'PROBE:' + JSON.stringify(probe);
    document.body.appendChild(pre);
  } catch (e) {
    var pre = document.createElement('pre');
    pre.id = 'layout-probe';
    pre.textContent = 'PROBE-ERROR:' + e.message;
    document.body.appendChild(pre);
  }
}, 800);
</script></head>`;

for (const [name, width] of [["probe-desktop", 1440], ["probe-narrow", 600]]) {
  const html = base.replace("</head>", probe).replace("</title>", " · " + name + "</title>");
  const path = dir + "growth-harness-" + name + ".html";
  writeFileSync(path, html);
  const out = execFileSync(
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ["--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=6000",
     "--window-size=" + width + ",900", "--dump-dom", "file:///" + path.replace(/\\/g, "/")],
    { encoding: "utf8" }
  );
  const m = out.match(/<pre id="layout-probe"[^>]*>([^<]+)<\/pre>/);
  console.log(name + " → " + (m ? m[1] : "NO PROBE OUTPUT (probe did not run)"));
}
