import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Canonical GTM custom VARIABLE template (CSP-safe replacement for the
// page-context Custom JS consent variables, which require 'unsafe-eval').
const templatePath = fileURLToPath(new URL("../../../gtm-templates/mildmate-consent-signal.js", import.meta.url));
const templateCode = readFileSync(templatePath, "utf-8");

function runVariable(signal: unknown, cookieValues: string[] | null) {
  const required: string[] = [];
  const requireShim = (name: string) => {
    required.push(name);
    if (name === "getCookieValues") {
      return () => (cookieValues === null ? [] : cookieValues);
    }
    throw new Error("variable template required an unexpected API: " + name);
  };
  const data = { signal };
  // Variable templates end with a top-level `return` — a Function body fits.
  // eslint-disable-next-line no-new-func
  return new Function("require", "data", templateCode)(requireShim, data) as string;
}

describe("GTM consent signal variable template (MildMate Consent Signal)", () => {
  it("requires only getCookieValues — no consent, global, or DOM access", () => {
    runVariable("analytics", []);
    // (required array captured inside runVariable; re-run and assert)
    const apis: string[] = [];
    const shim = (name: string) => { apis.push(name); return () => []; };
    // eslint-disable-next-line no-new-func
    new Function("require", "data", templateCode)(shim, { signal: "analytics" });
    expect(apis).toEqual(["getCookieValues"]);
  });

  it.each([
    ["analytics:granted,marketing:denied", "granted"],
    ["analytics:denied,marketing:granted", "denied"],
    ["analytics:denied,marketing:denied", "denied"],
    ["analytics:granted,marketing:granted", "granted"]
  ])("analytics signal on %s returns %s", (cookie, expected) => {
    expect(runVariable("analytics", [cookie])).toBe(expected);
  });

  it.each([
    ["analytics:granted,marketing:denied", "denied"],
    ["analytics:denied,marketing:granted", "granted"],
    ["analytics:denied,marketing:denied", "denied"],
    ["analytics:granted,marketing:granted", "granted"]
  ])("marketing signal on %s returns %s", (cookie, expected) => {
    expect(runVariable("marketing", [cookie])).toBe(expected);
  });

  it.each([
    [null, "absent cookie"],
    [undefined, "no cookies at all"],
    [[""], "empty value"],
    [["garbage"], "not key:value format"],
    [["analytics:granted"], "single segment"],
    [["analytics:granted,marketing:denied,extra:1"], "extra segment"],
    [["marketing:granted,analytics:denied,marketing:denied"], "duplicated segment"],
    [["analytics:maybe,marketing:denied"], "unrecognized value"],
    [["analytics:granted,marketing:TRUE"], "uppercase value"],
    [["Analytics:granted,marketing:denied"], "uppercase key"],
    [["analytics: granted,marketing:denied"], "embedded space"],
    [["analytics:granted,marketing:denied,"], "trailing comma"],
    [[" analytics:granted,marketing:denied"], "leading whitespace"],
    [["analytics:granted;marketing:denied"], "wrong separator"],
    [["foo:granted,marketing:denied"], "unknown key"],
    [["analytics:granted,marketing:denied", "analytics:denied,marketing:granted"], "duplicate mm-consent cookies"]
  ])("fails closed on %s (%s)", (cookies) => {
    expect(runVariable("analytics", cookies as string[])).toBe("denied");
    expect(runVariable("marketing", cookies as string[])).toBe("denied");
  });

  it("fails closed on unexpected field values", () => {
    for (const bad of [undefined, null, "", "Analytics", "ads", "both"]) {
      expect(runVariable(bad, ["analytics:granted,marketing:granted"])).toBe("denied");
    }
  });

  it("returns only granted or denied", () => {
    for (const cookie of [null, ["analytics:granted,marketing:granted"], ["bogus"]]) {
      for (const signal of ["analytics", "marketing"]) {
        expect(["granted", "denied"]).toContain(runVariable(signal, cookie as string[]));
      }
    }
  });

  describe("Sandboxed-JavaScript syntax gate (no unsupported constructs)", () => {
    // Gate applies to executable code only; comments are stripped so the
    // natural-language header cannot trip keyword checks.
    const codeOnly = templateCode
      .split("\n")
      .map((line) => line.replace(/\/\/.*$/, ""))
      .join("\n");

    it("contains no exception-handling blocks", () => {
      expect(codeOnly).not.toMatch(/\btry\b/);
      expect(codeOnly).not.toMatch(/\bcatch\b/);
      expect(codeOnly).not.toMatch(/\bfinally\b/);
      expect(codeOnly).not.toMatch(/\bthrow\b/);
    });

    it("contains no regular expressions or restricted APIs", () => {
      expect(codeOnly).not.toMatch(/\bRegExp\b/);
      expect(codeOnly).not.toMatch(/\.match\(/);
      expect(codeOnly).not.toMatch(/\.search\(/);
      expect(codeOnly).not.toMatch(/\.replace\(/);
      expect(codeOnly).not.toMatch(/\.test\(/);
      expect(codeOnly).not.toMatch(/\.exec\(/);
      expect(codeOnly).toContain("indexOf(':')");
      expect(codeOnly).toContain(".slice(");
    });

    it("contains no other restricted syntax (arrows, template literals, constructors, eval, this)", () => {
      expect(codeOnly).not.toMatch(/=>/);
      expect(codeOnly).not.toMatch(/`/);
      expect(codeOnly).not.toMatch(/\bnew\b/);
      expect(codeOnly).not.toMatch(/\bthis\b/);
      expect(codeOnly).not.toMatch(/\beval\b/);
      expect(codeOnly).not.toMatch(/\basync\b/);
      expect(codeOnly).not.toMatch(/\bawait\b/);
    });

    it("reads only the mm-consent cookie", () => {
      expect(codeOnly).toContain("const CONSENT_COOKIE = 'mm-consent';");
      expect(codeOnly).toContain("getCookieValues(CONSENT_COOKIE)");
    });
  });
});
