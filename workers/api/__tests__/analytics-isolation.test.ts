import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Relative to this test file so the suite validates the working tree it runs in.
const analyticsEnvPath = fileURLToPath(new URL("../../../public/js/analytics-env.js", import.meta.url));
const resolverModule = require(analyticsEnvPath);
const resolveMildMateAnalyticsConfig = resolverModule.resolveMildMateAnalyticsConfig as (input: any) => any;

describe("analytics environment isolation", () => {
  it("keeps production analytics enabled on production host with canonical GA4 ID", () => {
    const cfg = resolveMildMateAnalyticsConfig({ hostname: "www.mildmate.com" });
    expect(cfg.enabled).toBe(true);
    expect(cfg.gtmId).toBe("GTM-KLJZZM9");
    expect(cfg.ga4Id).toBe("G-0GWVSPJLVJ");
    expect(cfg.allowAdsConversions).toBe(true);
  });

  it("disables analytics by default on non-production hosts", () => {
    const cfg = resolveMildMateAnalyticsConfig({ hostname: "abc.mildmate-new.pages.dev" });
    expect(cfg.enabled).toBe(false);
    expect(cfg.reason).toBe("non_production_default_disabled");
  });

  it("allows isolated non-production analytics when explicitly approved", () => {
    const cfg = resolveMildMateAnalyticsConfig({
      hostname: "staging.mildmate.local",
      override: {
        nonProductionApproved: true,
        enabled: true,
        gtmId: "GTM-STAGE123",
        ga4Id: "G-STAGE123",
        environment: "staging",
      },
    });
    expect(cfg.enabled).toBe(true);
    expect(cfg.gtmId).toBe("GTM-STAGE123");
    expect(cfg.ga4Id).toBe("G-STAGE123");
    expect(cfg.allowAdsConversions).toBe(false);
  });

  it("blocks non-production config that attempts to use production IDs", () => {
    const cfg = resolveMildMateAnalyticsConfig({
      hostname: "preview.mildmate-new.pages.dev",
      override: {
        nonProductionApproved: true,
        enabled: true,
        gtmId: "GTM-KLJZZM9",
        ga4Id: "G-0GWVSPJLVJ",
      },
    });
    expect(cfg.enabled).toBe(false);
    expect(cfg.reason).toBe("non_production_ids_match_production_blocked");
  });

  it("legacy GA4 ID is rejected as the production measurement ID", () => {
    const cfg = resolveMildMateAnalyticsConfig({ hostname: "www.mildmate.com" });
    expect(cfg.ga4Id).not.toBe("G-ESL161CNBV");
  });

  it("checkout and order-confirmed load resolver script, consent script and gtm-noscript placeholder", () => {
    const checkoutHtml = readFileSync(new URL("../../../public/checkout/index.html", import.meta.url), "utf8");
    const confirmedHtml = readFileSync(new URL("../../../public/order-confirmed/index.html", import.meta.url), "utf8");
    for (const html of [checkoutHtml, confirmedHtml]) {
      expect(html.includes('/js/analytics-env.js')).toBe(true);
      expect(html.includes('/js/cookie-consent.js')).toBe(true);
      expect(html.includes('<noscript id="gtm-noscript"></noscript>')).toBe(true);
      expect(html.includes('__mildmateInitAnalytics')).toBe(true);
      expect(html.includes('G-ESL161CNBV')).toBe(false);
    }
  });
});
