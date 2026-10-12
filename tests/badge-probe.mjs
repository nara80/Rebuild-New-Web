// Verifies in real headless Chrome that the growth-summary Confidence badge
// renders the numeric score and never contains NaN.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

let html = readFileSync(dir + "growth-harness.html", "utf8");
// Focus the Growth Signals card (same as the acceptance capture variants).
html = html.replace(
  "</head>",
  "<style>#auth-gate{display:none!important}#app{display:block!important}" +
  ".toolbar,.filters,.card:not(#growth-card){display:none!important}" +
  ".content{padding:12px;max-width:none}</style></head>"
);
html = html.replace(
  "</body>",
  `<script>setTimeout(function(){
    try {
      var b = document.querySelector('#growth-summary').innerHTML;
      var hasNaN = /\\bNaN\\b/.test(b);
      var m = b.match(/Confidence: ([^<]*)/);
      var p = document.createElement('pre'); p.id = 'layout-probe';
      p.textContent = 'PROBE:' + JSON.stringify({ nan_found: hasNaN, confidence_text: m ? m[1] : null });
      document.body.appendChild(p);
    } catch (e) {
      var p = document.createElement('pre'); p.id = 'layout-probe';
      p.textContent = 'PROBE-ERROR:' + e.message;
      document.body.appendChild(p);
    }
  }, 800);</script></body>`
);
writeFileSync(dir + "badge-probe.html", html);
const out = execFileSync(chrome, [
  "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=6000",
  "--window-size=1440,900", "--dump-dom", "file:///" + (dir + "badge-probe.html").replace(/\\/g, "/"),
], { encoding: "utf8" });
const m = out.match(/<pre id="layout-probe"[^>]*>([^<]+)<\/pre>/);
console.log(m ? m[1] : "NO PROBE OUTPUT");
