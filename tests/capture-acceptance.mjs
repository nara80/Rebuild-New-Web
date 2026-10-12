// Captures the four visual-acceptance screenshots from the EXACT deployed
// implementation (commit b7116ce): desktop, narrow, expanded Momentum JSON,
// expanded Demand JSON. Harness renders the real page script with sanitized
// contract-v1 fixture data (no production credentials, no customer data).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Focused-card CSS: hide everything except the Growth Signals card.
const focusCss =
  "<style>#auth-gate{display:none!important}#app{display:block!important}" +
  ".toolbar,.filters,.card:not(#growth-card){display:none!important}" +
  ".content{padding:12px;max-width:none}</style>";

function variant(name, openIndex, width, outFile) {
  let html = readFileSync(dir + "growth-harness.html", "utf8");
  html = html.replace("</head>", focusCss + "</head>");
  if (openIndex !== null) {
    // Expand the Nth details disclosure (0 = demand.value, 2 = momentum.value)
    // right after render, then screenshot the expanded state.
    html = html.replace(
      "</body>",
      `<script>setTimeout(function(){var d=document.querySelectorAll('#growth-signals-table details');if(d[${openIndex}]){d[${openIndex}].open=true;}},700);</script></body>`
    );
  }
  html = html.replace("</title>", " · " + name + "</title>");
  const path = dir + "growth-harness-" + name + ".html";
  writeFileSync(path, html);
  execFileSync(chrome, [
    "--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=6000",
    "--window-size=" + width + ",900",
    "--screenshot=" + dir + outFile,
    "file:///" + path.replace(/\\/g, "/"),
  ]);
  console.log(outFile + " captured");
}

variant("desktop", null, 1440, "growth-desktop-1440.png");
variant("narrow", null, 600, "growth-narrow-600.png");
variant("momentum-open", 2, 1440, "growth-momentum-json-expanded.png");
variant("demand-open", 0, 1440, "growth-demand-json-expanded.png");
