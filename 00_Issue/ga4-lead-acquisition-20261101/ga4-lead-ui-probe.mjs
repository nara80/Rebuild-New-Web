import fs from "node:fs";
const beforePath = "D:/00_mildmate/re-build_web/00_Issue/ga4-lead-acquisition-20261101/data-analyst-before.html";
const afterPath = "D:/00_mildmate/re-build_web/00_Issue/ga4-lead-acquisition-20261101/data-analyst-after.html";
const before = fs.readFileSync(beforePath, "utf8");
const after = fs.readFileSync(afterPath, "utf8");
const tabKeys = [...after.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
const uniqueTabs = [...new Set(tabKeys)];
const checks = {
  seven_tabs_preserved: JSON.stringify(uniqueTabs) === JSON.stringify(["overview","sales","seo","etsy","google-ads","growth","data-quality"]),
  ga4_lead_card_present: after.includes('id="ga4-lead-card"') && after.includes('data-tab-group="seo"'),
  ga4_lead_loader_present: after.includes('async function loadGa4LeadAcquisition') && after.includes("api('/ga4-leads"),
  apply_filters_calls_loader: after.includes('loadGa4(); loadGa4LeadAcquisition(); loadEtsy();'),
  load_all_calls_loader: after.includes('loadGa4(); loadGa4LeadAcquisition(); loadEtsy();'),
  responsive_table_wraps_present: ['ga4-lead-trend-table','ga4-lead-sources-table','ga4-lead-campaigns-table'].every((id) => new RegExp(`<div class="table-wrap"><div id="${id}">`, 'i').test(after)),
  no_fabricated_unique_leads_label: !/unique\s*lead/i.test(after),
};
const addedBytes = Buffer.byteLength(after, 'utf8') - Buffer.byteLength(before, 'utf8');
const out = {
  checks,
  added_bytes: addedBytes,
  before_size: Buffer.byteLength(before, 'utf8'),
  after_size: Buffer.byteLength(after, 'utf8'),
  tabs: uniqueTabs,
};
fs.writeFileSync("D:/00_mildmate/re-build_web/00_Issue/ga4-lead-acquisition-20261101/ga4-lead-ui-probe.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
if (!Object.values(checks).every(Boolean)) {
  process.exit(1);
}
