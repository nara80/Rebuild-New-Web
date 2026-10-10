import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const resolverModule = require(fileURLToPath(new URL("../../../public/js/analytics-env.js", import.meta.url)));

// analytics-env.js attaches helpers to globalThis when loaded outside a browser.
declare global {
  // eslint-disable-next-line no-var
  var __mildmateTrackEvent: (name: string, params?: any) => void;
  // eslint-disable-next-line no-var
  var __mildmateInitAnalytics: (opts?: any) => boolean;
  // eslint-disable-next-line no-var
  var dataLayer: any[];
}

const ECOM_EVENTS = ["view_item", "add_to_cart", "view_cart", "begin_checkout", "purchase"];

function itemsFixture() {
  return [
    { item_id: "standard-fitted-sheet", item_name: "Standard Fitted Sheet", price: 52, quantity: 1 },
    { item_id: "pillowcase-envelope", item_name: "Envelope Pillowcase", price: 18.5, quantity: 2 }
  ];
}

describe("GA4 dataLayer contract (GTM eventModel compatibility)", () => {
  beforeEach(() => {
    globalThis.dataLayer = [];
  });

  it.each(ECOM_EVENTS)("pushes %s with event + eventModel + ecommerce alias", (eventName) => {
    globalThis.__mildmateTrackEvent(eventName, {
      currency: "USD",
      value: 89,
      items: itemsFixture(),
      ...(eventName === "purchase" ? { transaction_id: "cs_test_abc123" } : {})
    });

    const entry = globalThis.dataLayer.find((e) => e && e.event === eventName);
    expect(entry).toBeDefined();
    // GTM DLV variables read eventModel.* — this is the Ads purchase contract.
    expect(entry.eventModel).toBeDefined();
    expect(entry.eventModel.currency).toBe("USD");
    expect(entry.eventModel.value).toBe(89);
    expect(Array.isArray(entry.eventModel.items)).toBe(true);
    expect(entry.eventModel.items[0]).toEqual(
      expect.objectContaining({ item_id: "standard-fitted-sheet", price: 52, quantity: 1 })
    );
    // ecommerce alias so GA4 event tags configured for the ecommerce object also resolve.
    expect(entry.ecommerce).toEqual(entry.eventModel);
  });

  it("purchase carries a non-empty transaction_id", () => {
    globalThis.__mildmateTrackEvent("purchase", {
      transaction_id: "cs_test_abc123",
      value: 1590,
      currency: "THB",
      items: itemsFixture()
    });
    const entry = globalThis.dataLayer.find((e) => e && e.event === "purchase");
    expect(typeof entry.eventModel.transaction_id).toBe("string");
    expect(entry.eventModel.transaction_id.length).toBeGreaterThan(0);
    expect(entry.eventModel.currency).toBe("THB");
  });

  it("numeric value stays numeric (no string coercion)", () => {
    globalThis.__mildmateTrackEvent("purchase", { transaction_id: "x", value: 123.45, currency: "USD", items: [] });
    const entry = globalThis.dataLayer.find((e) => e && e.event === "purchase");
    expect(typeof entry.eventModel.value).toBe("number");
  });

  it("ignores empty event names and non-object params", () => {
    globalThis.__mildmateTrackEvent("", { a: 1 });
    globalThis.__mildmateTrackEvent("view_item", "not-an-object" as any);
    const entries = globalThis.dataLayer.filter((e) => e && e.event);
    expect(entries.length).toBe(1);
    expect(entries[0].event).toBe("view_item");
    expect(entries[0].eventModel).toEqual({});
  });

  it("init does not load analytics without stored consent (basic consent gate)", () => {
    // No localStorage in Node -> hasAnalyticsConsent() must be false.
    expect(resolverModule.hasAnalyticsConsent()).toBe(false);
    const booted = globalThis.__mildmateInitAnalytics({ mobileLazy: false });
    expect(booted).toBe(false);
    // Nothing may enqueue gtm.js start before consent.
    const gtmStart = globalThis.dataLayer.find((e) => e && e.event === "gtm.js");
    expect(gtmStart).toBeUndefined();
  });
});
