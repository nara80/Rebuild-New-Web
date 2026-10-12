// Objective check for the expanded-JSON screenshots: verifies in real headless
// Chrome that the Momentum/Demand Full-JSON disclosures open and their <pre>
// payloads are visibly rendered (non-zero height, full JSON content present).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const base = readFileSync(dir + "growth-harness.html", "utf8");

function probe(name, openIndex, expectKey) {
  let html = base.replace(
    "</body>",
    `<script>setTimeout(function(){
      try {
        var d = document.querySelectorAll('#growth-signals-table details');
        d[${openIndex}].open = true;
        var pre = d[${openIndex}].querySelector('pre');
        var rect = pre.getBoundingClientRect();
        var out = {
          open: d[${openIndex}].open,
          pre_visible_height: Math.round(rect.height),
          pre_rows: pre.textContent.split('\\n').length,
          contains_expected_key: pre.textContent.indexOf(${JSON.stringify(expectKey)}) > -1,
          json_parses: (function(){ try { JSON.parse(pre.textContent); return true; } catch(e){ return false; } })()
        };
        var p = document.createElement('pre'); p.id = 'layout-probe';
        p.textContent = 'PROBE:' + JSON.stringify(out);
        document.body.appendChild(p);
      } catch (e) {
        var p = document.createElement('pre'); p.id = 'layout-probe';
        p.textContent = 'PROBE-ERROR:' + e.message;
        document.body.appendChild(p);
      }
    }, 800);</script></body>`
  );
  const path = dir + "expanded-probe-" + name + ".html";
  writeFileSync(path, html);
  const out = execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=6000",
    "--window-size=1440,900", "--dump-dom", "file:///" + path.replace(/\\/g, "/"),
  ], { encoding: "utf8" });
  const m = out.match(/<pre id="layout-probe"[^>]*>([^<]+)<\/pre>/);
  console.log(name + " → " + (m ? m[1] : "NO PROBE OUTPUT"));
}

probe("momentum", 2, "units_growth_pct");
probe("demand", 0, "sessions_28d");
