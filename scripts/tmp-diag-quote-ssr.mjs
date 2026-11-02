import * as esbuild from "esbuild";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const ROOT = "D:/00_mildmate/re-build_web";
const tmp = path.join(process.env.TEMP, "quote-fn-ssr.mjs");

await esbuild.build({
  entryPoints: [path.join(ROOT, "functions/quote/[[path]].ts")],
  outfile: tmp,
  format: "esm",
  platform: "neutral",
  bundle: false,
});

const mod = await import("file://" + tmp.replace(/\\/g, "/"));

class D1 {
  quotes = new Map();
  prepare() {
    const self = this;
    return {
      bind() { return this; },
      async first(sql) { return self.quotes.get("QT-TEST-001") || null; },
    };
  }
}
const db = new D1();
db.quotes.set("QT-TEST-001", {
  quote_id: "QT-TEST-001", customer_name: "T",
  product_slug: "custom-waterproof-cushion-protector",
  dimensions: JSON.stringify({ w: 60, l: 60, d: 12, unit: "cm" }),
  fabric: "BreezePlus", color: "Beige", status: "approved",
  quoted_price: 5940, quoted_price_usd: 198, free_shipping: 0,
  expires_at: "2099-01-01T00:00:00", created_at: "2026-10-01",
});
const resp = await mod.onRequest({
  request: new Request("https://www.mildmate.com/quote/QT-TEST-001/"),
  env: { DB: db },
  params: {},
});
const html = await resp.text();
fs.writeFileSync(path.join(process.env.TEMP, "quote-ssr-rendered.html"), html);

// count tag occurrences
const opens = (html.match(/<script>/g) || []).length;
const closes = (html.match(/<\/script>/g) || []).length;
const withAttr = (html.match(/<script [^>]*>/g) || []).length;
console.log("inline <script> opens:", opens, "closes:", closes, "attr opens:", withAttr);

const re = /<script>([\s\S]*?)<\/script>/g;
let i = 0, m;
while ((m = re.exec(html)) !== null) {
  i++;
  try { new vm.Script(m[1]); console.log("script", i, "OK len=" + m[1].length); }
  catch (e) {
    console.log("script", i, "FAIL:", e.message);
    console.log("  starts:", JSON.stringify(m[1].slice(0, 100)));
    console.log("  ends:", JSON.stringify(m[1].slice(-100)));
    if (e.stack) console.log("  stack:", e.stack.split("\n").slice(0, 4).join("\n"));
    // dump the failing region around the reported column
    const stackLine = e.stack.split("\n")[0];
    console.log("  stackline:", stackLine);
    try {
      // bisect: compile progressively larger prefixes to find failure offset
      let lo = 0, hi = m[1].length;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        try { new vm.Script(m[1].slice(0, mid)); lo = mid; }
        catch { hi = mid - 1; }
        if (hi - lo < 2) break;
      }
      console.log("  fails near offset:", lo, "->", JSON.stringify(m[1].slice(Math.max(0, lo - 120), lo + 80)));
    } catch (e2) { console.log("  bisect fail", e2.message); }
  }
}
console.log("matched scripts:", i);
