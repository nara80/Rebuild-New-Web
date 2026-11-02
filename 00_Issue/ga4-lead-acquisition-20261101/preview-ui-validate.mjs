import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = 'https://ga4-lead-gate-preview.mildmate-new.pages.dev';
const outDir = process.argv[2];

const mockPayload = {
  success: true,
  available: true,
  property: { canonical_property_id: '308922589', overlap_days: 0, overlap_start: null, overlap_end: null },
  coverage: { min_report_date: '2026-10-01', max_report_date: '2026-10-31', rows_n: 3 },
  freshness: { status: 'ok', latest_report_date: '2026-10-31', days_since_latest_report: 1 },
  summary: { generate_lead_events: 12, generate_lead_users: 8, generate_lead_users_available: true, quote_request_events: 6, quote_request_users: 5, quote_request_users_available: true },
  trend_daily: [
    { report_date: '2026-10-29', generate_lead_events: 4, generate_lead_users: 3, generate_lead_users_available: true, quote_request_events: 2, quote_request_users: 2, quote_request_users_available: true },
    { report_date: '2026-10-30', generate_lead_events: 3, generate_lead_users: 2, generate_lead_users_available: true, quote_request_events: 1, quote_request_users: 1, quote_request_users_available: true },
    { report_date: '2026-10-31', generate_lead_events: 5, generate_lead_users: 3, generate_lead_users_available: true, quote_request_events: 3, quote_request_users: 2, quote_request_users_available: true }
  ],
  top_sources: [
    { source_medium: 'google / cpc', generate_lead_events: 8, generate_lead_users: 5, generate_lead_users_available: true, quote_request_events: 3, quote_request_users: 2, quote_request_users_available: true },
    { source_medium: 'direct / (none)', generate_lead_events: 4, generate_lead_users: 3, generate_lead_users_available: true, quote_request_events: 3, quote_request_users: 3, quote_request_users_available: true }
  ],
  top_campaigns: [
    { campaign: 'brand-search', generate_lead_events: 6, generate_lead_users: 4, generate_lead_users_available: true, quote_request_events: 2, quote_request_users: 2, quote_request_users_available: true },
    { campaign: '(unavailable)', generate_lead_events: 6, generate_lead_users: 4, generate_lead_users_available: true, quote_request_events: 4, quote_request_users: 3, quote_request_users_available: true }
  ],
  limitations: ['Representative mocked payload for preview layout validation.', 'Canonical property only semantics preserved.']
};

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true, channel: 'msedge' });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

async function runCase(browser, name, viewport, useMock) {
  const context = await browser.newContext({ viewport });
  if (useMock) {
    await context.route('**/api/admin/analysis/ga4-leads**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPayload) });
    });
  }

  const page = await context.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

  await page.goto(`${base}/super-admin/marketing/data-analyst/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const btn = document.querySelector('#dashboard-tab-nav .tab-btn[data-tab="seo"]');
    if (btn) btn.click();
    const card = document.getElementById('ga4-lead-card');
    if (card) card.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(1000);

  const metrics = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('#dashboard-tab-nav .tab-btn')).map((b) => b.getAttribute('data-tab'));
    const tabVisibility = {};
    for (const tab of tabs) {
      const btn = document.querySelector(`#dashboard-tab-nav .tab-btn[data-tab="${tab}"]`);
      if (btn) btn.click();
      const cards = Array.from(document.querySelectorAll(`[data-tab-group="${tab}"]`));
      const visible = cards.filter((el) => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden';
      }).length;
      tabVisibility[tab] = { cards_total: cards.length, cards_visible_after_click: visible };
    }
    const seoBtn = document.querySelector('#dashboard-tab-nav .tab-btn[data-tab="seo"]');
    if (seoBtn) seoBtn.click();

    const leadCard = document.getElementById('ga4-lead-card');
    const summary = document.getElementById('ga4-lead-summary');
    const notes = document.getElementById('ga4-lead-notes');
    const trendWrap = document.getElementById('ga4-lead-trend-table')?.closest('.table-wrap');
    const sourceWrap = document.getElementById('ga4-lead-sources-table')?.closest('.table-wrap');
    const campaignWrap = document.getElementById('ga4-lead-campaigns-table')?.closest('.table-wrap');
    const docEl = document.documentElement;
    const wrapMetrics = (el) => el ? { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth, horizontalScrollNeeded: el.scrollWidth > el.clientWidth } : null;
    const leadRect = leadCard ? leadCard.getBoundingClientRect() : null;

    return {
      tabs,
      tabVisibility,
      docOverflowX: docEl.scrollWidth - docEl.clientWidth,
      docHasHorizontalOverflow: docEl.scrollWidth > docEl.clientWidth,
      ga4LeadSummaryText: summary ? summary.textContent?.replace(/\s+/g, ' ').trim() : null,
      ga4LeadNotesText: notes ? notes.textContent?.replace(/\s+/g, ' ').trim() : null,
      ga4LeadBadgeCount: summary ? summary.querySelectorAll('.badge').length : 0,
      ga4LeadCardFitsViewport: leadRect ? (leadRect.left >= -1 && leadRect.right <= (window.innerWidth + 1)) : false,
      trendWrap: wrapMetrics(trendWrap),
      sourceWrap: wrapMetrics(sourceWrap),
      campaignWrap: wrapMetrics(campaignWrap)
    };
  });

  const shot = path.join(outDir, `preview-${name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  await context.close();
  return { name, viewport, useMock, screenshot: shot, metrics, console: logs.slice(-20) };
}

async function main() {
  const browser = await launchBrowser();
  const results = [];
  results.push(await runCase(browser, 'desktop-unavailable', { width: 1366, height: 900 }, false));
  results.push(await runCase(browser, 'mobile-unavailable', { width: 390, height: 844 }, false));
  results.push(await runCase(browser, 'desktop-mock', { width: 1366, height: 900 }, true));
  results.push(await runCase(browser, 'mobile-mock', { width: 390, height: 844 }, true));
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'preview-ui-validation.json'), JSON.stringify({ base, generated_at: new Date().toISOString(), results }, null, 2));
  console.log(`Wrote ${results.length} cases to preview-ui-validation.json`);
}

main().catch((err) => { console.error(err); process.exit(1); });

