const fs = require('fs');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' }).catch(() => chromium.launch({ headless: true }));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/api/admin/analysis/ga4-leads**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        available: true,
        property: { canonical_property_id: '308922589' },
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
        limitations: []
      })
    });
  });
  const page = await context.newPage();
  await page.goto('https://ga4-lead-gate-preview.mildmate-new.pages.dev/super-admin/marketing/data-analyst/?dev=1', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const btn = document.querySelector('#dashboard-tab-nav .tab-btn[data-tab="seo"]');
    if (btn) btn.click();
    const wrappers = ['ga4-lead-trend-table','ga4-lead-sources-table','ga4-lead-campaigns-table'].map((id) => {
      const wrap = document.getElementById(id)?.closest('.table-wrap');
      if (!wrap) return { id, exists: false };
      const before = wrap.scrollLeft;
      wrap.scrollLeft = 120;
      const after = wrap.scrollLeft;
      return { id, exists: true, clientWidth: wrap.clientWidth, scrollWidth: wrap.scrollWidth, before, after, scrollable: wrap.scrollWidth > wrap.clientWidth, scrolled: after > before };
    });
    return { wrappers, docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
})();
