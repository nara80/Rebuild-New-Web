import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const resolverModule = require("D:\\00_mildmate\\re-build_web\\public\\js\\analytics-env.js");
const resolveMildMateAnalyticsConfig = resolverModule.resolveMildMateAnalyticsConfig as (input: any) => any;

describe("analytics environment isolation", () => {
  it("keeps production analytics enabled on production host", () => {
    const cfg = resolveMildMateAnalyticsConfig({ hostname: "www.mildmate.com" });
    expect(cfg.enabled).toBe(true);
    expect(cfg.gtmId).toBe("GTM-KLJZZM9");
    expect(cfg.ga4Id).toBe("G-ESL161CNBV");
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
        ga4Id: "G-ESL161CNBV",
      },
    });
    expect(cfg.enabled).toBe(false);
    expect(cfg.reason).toBe("non_production_ids_match_production_blocked");
  });

  it("checkout and order-confirmed load resolver script and avoid hardcoded noscript GTM id", () => {
    const checkoutHtml = readFileSync("D:\\00_mildmate\\re-build_web\\public\\checkout\\index.html", "utf8");
    const confirmedHtml = readFileSync("D:\\00_mildmate\\re-build_web\\public\\order-confirmed\\index.html", "utf8");
    expect(checkoutHtml.includes('/js/analytics-env.js')).toBe(true);
    expect(confirmedHtml.includes('/js/analytics-env.js')).toBe(true);
    expect(checkoutHtml.includes('<noscript id="gtm-noscript"></noscript>')).toBe(true);
    expect(confirmedHtml.includes('<noscript id="gtm-noscript"></noscript>')).toBe(true);
  });
});
