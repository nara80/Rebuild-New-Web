import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The canonical GTM consent template lives in the repo so tests, report, and
// the GTM paste can never drift apart.
const templatePath = fileURLToPath(new URL("../../../gtm-templates/mildmate-consent-bridge.js", import.meta.url));
const templateCode = readFileSync(templatePath, "utf-8");

const ALL_DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied"
};

type ConsentState = Record<string, string>;
type Listener = (payload: Record<string, boolean>) => void;

function runTemplate(cookieValue: string | string[] | null) {
  const defaults: ConsentState[] = [];
  const updates: ConsentState[] = [];
  let listener: Listener | null = null;
  let callInWindowKeys: string[] = [];
  const required: string[] = [];

  const requireShim = (name: string) => {
    required.push(name);
    switch (name) {
      case "setDefaultConsentState":
        return (state: ConsentState) => defaults.push(state);
      case "updateConsentState":
        return (state: ConsentState) => updates.push(state);
      case "getCookieValues":
        return () => (cookieValue === null ? [] : Array.isArray(cookieValue) ? cookieValue : [cookieValue]);
      case "callInWindow":
        return (key: string, cb: Listener) => {
          callInWindowKeys.push(key);
          listener = cb;
        };
      default:
        throw new Error("template required an unexpected API: " + name);
    }
  };
  const data = { gtmOnSuccess: () => {}, gtmOnFailure: () => { throw new Error("gtmOnFailure"); } };

  // Execute the sandboxed template body with stubbed template APIs.
  // eslint-disable-next-line no-new-func
  new Function("require", "data", templateCode)(requireShim, data);
  return {
    defaults,
    updates,
    listener: listener as Listener | null,
    callInWindowKeys,
    required
  };
}

describe("GTM consent template (MildMate Consent Bridge)", () => {
  it("sets the default consent state to all four signals denied, exactly once", () => {
    const { defaults, updates } = runTemplate(null);
    expect(defaults.length).toBe(1);
    expect(defaults[0]).toEqual(ALL_DENIED);
    expect(updates.length).toBe(0);
  });

  it.each([
    ["analytics:granted,marketing:denied", "granted", "denied"],
    ["analytics:granted,marketing:granted", "granted", "granted"],
    ["analytics:denied,marketing:granted", "denied", "granted"],
    ["analytics:denied,marketing:denied", "denied", "denied"]
  ])("applies saved choice %s exactly (returning-user path)", (cookie, analytics, marketing) => {
    const { updates } = runTemplate(cookie);
    expect(updates.length).toBe(1);
    expect(updates[0]).toEqual({
      analytics_storage: analytics,
      ad_storage: marketing,
      ad_user_data: marketing,
      ad_personalization: marketing
    });
  });

  it.each([
    ["", "empty value"],
    ["garbage", "not key:value format"],
    ["analytics:granted", "only one segment"],
    ["analytics:granted,marketing:denied,extra:1", "extra segment"],
    ["marketing:granted,analytics:denied,marketing:denied", "duplicated key"],
    ["analytics:maybe,marketing:denied", "unrecognized value"],
    ["analytics:granted,marketing:TRUE", "uppercase value"],
    ["Analytics:granted,marketing:denied", "uppercase key"],
    ["analytics: granted,marketing:denied", "embedded space"],
    ["analytics:granted,marketing:denied,", "trailing comma"],
    [" analytics:granted,marketing:denied", "leading whitespace"],
    ["analytics:granted;marketing:denied", "wrong separator"],
    ["foo:granted,marketing:denied", "unknown key"]
  ])("malformed cookie (%s: %s) leaves consent fully denied", (cookie) => {
    const { defaults, updates } = runTemplate(cookie);
    expect(defaults).toEqual([ALL_DENIED]);
    // No updateConsentState call: the denied default remains operative.
    expect(updates.length).toBe(0);
  });

  it("absent cookie makes no update call", () => {
    const { defaults, updates } = runTemplate(null);
    expect(defaults).toEqual([ALL_DENIED]);
    expect(updates.length).toBe(0);
  });

  describe("duplicate / conflicting mm-consent cookies (fail closed)", () => {
    // getCookieValues returns one entry per matching cookie; more than one
    // means an ambiguous cookie state. The bridge must deny (no update) —
    // matching the MildMate Consent Signal variable template.
    it("two conflicting cookies make no update call (previously values[0] won)", () => {
      const { defaults, updates } = runTemplate([
        "analytics:granted,marketing:denied",
        "analytics:denied,marketing:granted"
      ]);
      expect(defaults).toEqual([ALL_DENIED]);
      expect(updates.length).toBe(0);
    });

    it("two identical cookies still fail closed (strict single-cookie rule)", () => {
      const { defaults, updates } = runTemplate([
        "analytics:granted,marketing:denied",
        "analytics:granted,marketing:denied"
      ]);
      expect(defaults).toEqual([ALL_DENIED]);
      expect(updates.length).toBe(0);
    });

    it("three conflicting cookies make no update call", () => {
      const { defaults, updates } = runTemplate([
        "analytics:granted,marketing:granted",
        "analytics:denied,marketing:granted",
        "analytics:denied,marketing:denied"
      ]);
      expect(defaults).toEqual([ALL_DENIED]);
      expect(updates.length).toBe(0);
    });

    it("duplicate cookies plus a malformed value make no update call", () => {
      const { defaults, updates } = runTemplate([
        "analytics:granted,marketing:denied",
        "garbage"
      ]);
      expect(defaults).toEqual([ALL_DENIED]);
      expect(updates.length).toBe(0);
    });
  });

  describe("live listener (callInWindow)", () => {
    it("registers exactly one listener under the contracted registry key", () => {
      const { callInWindowKeys, listener } = runTemplate(null);
      expect(callInWindowKeys).toEqual(["__mildmateAddConsentListener"]);
      expect(typeof listener).toBe("function");
    });

    it("maps the site listener payload to the four consent signals", () => {
      const { listener, updates } = runTemplate(null);
      listener!({ analyticsConsentGranted: true, adConsentGranted: true, adUserDataConsentGranted: true, adPersonalizationConsentGranted: true });
      expect(updates[0]).toEqual({ analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });

      listener!({ analyticsConsentGranted: true, adConsentGranted: false, adUserDataConsentGranted: false, adPersonalizationConsentGranted: false });
      expect(updates[1]).toEqual({ analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });

      // Withdrawal: everything denied.
      listener!({ analyticsConsentGranted: false, adConsentGranted: false, adUserDataConsentGranted: false, adPersonalizationConsentGranted: false });
      expect(updates[2]).toEqual(ALL_DENIED);
    });

    it("never infers marketing from analytics (partial payload -> denied ads signals)", () => {
      const { listener, updates } = runTemplate(null);
      listener!({ analyticsConsentGranted: true } as Record<string, boolean>);
      expect(updates[0]).toEqual({ analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    });

    it("treats null/undefined payload as full denial", () => {
      const { listener, updates } = runTemplate(null);
      listener!(null as unknown as Record<string, boolean>);
      expect(updates[0]).toEqual(ALL_DENIED);
    });
  });

  describe("required template permissions (static source assertions)", () => {
    it("requires exactly the four consent/cookie/window APIs — nothing else", () => {
      const { required } = runTemplate(null);
      expect(required.sort()).toEqual(
        ["callInWindow", "getCookieValues", "setDefaultConsentState", "updateConsentState"].sort()
      );
    });

    it("source requires only the documented APIs (no dataLayer, injectScript, or localStorage access)", () => {
      for (const api of ["setDefaultConsentState", "updateConsentState", "getCookieValues", "callInWindow"]) {
        expect(templateCode).toContain(`require('${api}')`);
      }
      expect(templateCode).toMatch(/require\('[^']+'\)/g);
      const requiredApis = Array.from(templateCode.matchAll(/require\('([^']+)'\)/g)).map((m) => m[1]);
      expect(requiredApis.sort()).toEqual(
        ["callInWindow", "getCookieValues", "setDefaultConsentState", "updateConsentState"].sort()
      );
      // Forbidden broader capabilities.
      expect(templateCode).not.toContain("injectScript");
      expect(templateCode).not.toContain("localStorage");
      expect(templateCode).not.toContain("dataLayer");
      expect(templateCode).not.toContain("document.cookie");
    });

    it("callInWindow is used for exactly one global key: __mildmateAddConsentListener", () => {
      const keys = Array.from(templateCode.matchAll(/callInWindow\(([^,]+),/g)).map((m) => m[1].trim());
      expect(keys.length).toBe(1);
      // The key comes from a constant; assert the constant literal and its use.
      expect(templateCode).toContain("const CONSENT_LISTENER_KEY = '__mildmateAddConsentListener';");
      expect(templateCode).toContain("callInWindow(CONSENT_LISTENER_KEY");
      expect(keys[0]).toBe("CONSENT_LISTENER_KEY");
    });

    it("declares the access_globals Execute permission and reads only the mm-consent cookie", () => {
      expect(templateCode).toContain("__mildmateAddConsentListener");
      expect(templateCode).toContain("Execute only");
      expect(templateCode).toContain("mm-consent");
      const cookieNames = Array.from(templateCode.matchAll(/getCookieValues\(([^)]+)\)/g)).map((m) => m[1].trim());
      expect(cookieNames).toEqual(["CONSENT_COOKIE"]);
      expect(templateCode).toContain("const CONSENT_COOKIE = 'mm-consent';");
    });
  });

  describe("Sandboxed-JavaScript syntax gate (no unsupported constructs)", () => {
    // The gate applies to executable code only; comments are stripped so the
    // natural-language header cannot trip keyword checks.
    const templateCodeOnly = templateCode
      .split("\n")
      .map((line) => line.replace(/\/\/.*/, "")) // no $ anchor: `.` cannot match \r (CRLF checkouts)
      .join("\n");

    it("contains no exception-handling blocks", () => {
      expect(templateCodeOnly).not.toMatch(/\btry\b/);
      expect(templateCodeOnly).not.toMatch(/\bcatch\b/);
      expect(templateCodeOnly).not.toMatch(/\bfinally\b/);
      expect(templateCodeOnly).not.toMatch(/\bthrow\b/);
    });

    it("contains no regular expressions (literals or RegExp constructor)", () => {
      expect(templateCodeOnly).not.toMatch(/\bRegExp\b/);
      expect(templateCodeOnly).not.toMatch(/\.match\(/);
      expect(templateCodeOnly).not.toMatch(/\.search\(/);
      expect(templateCodeOnly).not.toMatch(/\.replace\(/);
      expect(templateCodeOnly).not.toMatch(/\.replaceAll\(/);
      expect(templateCodeOnly).not.toMatch(/\.test\(/);
      expect(templateCodeOnly).not.toMatch(/\.exec\(/);
      // Parser must be built on sandbox-safe string primitives instead.
      expect(templateCodeOnly).toContain("indexOf(':')");
      expect(templateCodeOnly).toContain(".slice(");
    });

    it("contains no other restricted syntax (arrows, template literals, constructors, eval, this)", () => {
      expect(templateCodeOnly).not.toMatch(/=>/);
      expect(templateCodeOnly).not.toMatch(/`/);
      expect(templateCodeOnly).not.toMatch(/\bnew\b/);
      expect(templateCodeOnly).not.toMatch(/\bthis\b/);
      expect(templateCodeOnly).not.toMatch(/\beval\b/);
      expect(templateCodeOnly).not.toMatch(/\basync\b/);
      expect(templateCodeOnly).not.toMatch(/\bawait\b/);
    });

    it("executes end-to-end without exceptions under the API stubs (implicit no-throw gate)", () => {
      // runTemplate throws if the template body throws for any input shape.
      for (const cookie of [null, "", "analytics:granted,marketing:denied", "bogus"]) {
        expect(() => runTemplate(cookie)).not.toThrow();
      }
    });
  });
});
