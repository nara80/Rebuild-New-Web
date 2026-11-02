import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { verifyClerkJwt } from "../clerk-verify";
import {
  authorizeAdminBrowser,
  authorizeAdminForRoute,
  authorizeAdminMachineSecret,
  classifyAdminApiPath,
  normalizeAdminApiPath,
} from "../admin-auth";

const verifyMock = vi.mocked(verifyClerkJwt);

function req(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers: headers || {} });
}

describe("admin-auth R1 hardening", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("authorizeAdminBrowser denies missing bearer token", async () => {
    const res = await authorizeAdminBrowser(req("https://www.mildmate.com/api/admin/stats"), {
      ADMIN_EMAILS: "admin@example.com",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });

  it("authorizeAdminBrowser denies invalid JWT", async () => {
    verifyMock.mockResolvedValue({ valid: false, status: 401, error: "Invalid token" } as any);
    const res = await authorizeAdminBrowser(
      req("https://www.mildmate.com/api/admin/stats", {
        Authorization: "Bearer invalid.token",
      }),
      { ADMIN_EMAILS: "admin@example.com" }
    );
    expect(res).toEqual({ ok: false, status: 401, error: "Invalid token" });
  });

  it("authorizeAdminBrowser enforces role+allowlist AND logic", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "admin" }, email: "customer@example.com", sub: "user_1" },
    } as any);

    const res = await authorizeAdminBrowser(
      req("https://www.mildmate.com/api/admin/stats", {
        Authorization: "Bearer valid.jwt",
      }),
      { ADMIN_EMAILS: "admin@example.com" }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("authorizeAdminBrowser denies denylisted email", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "admin" }, email: "admin@example.com", sub: "user_1" },
    } as any);

    const res = await authorizeAdminBrowser(
      req("https://www.mildmate.com/api/admin/stats", {
        Authorization: "Bearer valid.jwt",
      }),
      {
        ADMIN_EMAILS: "admin@example.com",
        ADMIN_BLOCKED_EMAILS: "admin@example.com",
      }
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
      expect(res.error).toContain("not authorized");
    }
  });

  it("authorizeAdminBrowser allows authorized admin", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "super-admin" }, email: "admin@example.com", sub: "user_1" },
    } as any);

    const res = await authorizeAdminBrowser(
      req("https://www.mildmate.com/api/admin/stats", {
        Authorization: "Bearer valid.jwt",
      }),
      { ADMIN_EMAILS: "admin@example.com" }
    );

    expect(res).toEqual({ ok: true });
  });

  it("authorizeAdminBrowser can enrich via Clerk API when JWT lacks role/email", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: {}, email: "", sub: "user_123" },
    } as any);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          primary_email_address_id: "ea_1",
          email_addresses: [{ id: "ea_1", email_address: "admin@example.com" }],
          public_metadata: { role: "admin" },
        }),
      })) as any
    );

    const res = await authorizeAdminBrowser(
      req("https://www.mildmate.com/api/admin/stats", {
        Authorization: "Bearer valid.jwt",
      }),
      {
        ADMIN_EMAILS: "admin@example.com",
        CLERK_SECRET_KEY: "sk_test_x",
      }
    );

    expect(res).toEqual({ ok: true });
  });

  it("authorizeAdminMachineSecret fails closed when secret missing or wrong", async () => {
    const noHeader = await authorizeAdminMachineSecret(
      req("https://www.mildmate.com/api/admin/subscribers"),
      { ADMIN_SECRET: "expected" }
    );
    expect(noHeader.ok).toBe(false);

    const noConfigured = await authorizeAdminMachineSecret(
      req("https://www.mildmate.com/api/admin/subscribers", { "X-Admin-Secret": "anything" }),
      {}
    );
    expect(noConfigured.ok).toBe(false);

    const wrong = await authorizeAdminMachineSecret(
      req("https://www.mildmate.com/api/admin/subscribers", { "X-Admin-Secret": "wrong" }),
      { ADMIN_SECRET: "expected" }
    );
    expect(wrong.ok).toBe(false);

    const good = await authorizeAdminMachineSecret(
      req("https://www.mildmate.com/api/admin/subscribers", { "X-Admin-Secret": "expected" }),
      { ADMIN_SECRET: "expected" }
    );
    expect(good).toEqual({ ok: true });
  });

  it("classifyAdminApiPath normalizes path variants safely", () => {
    expect(normalizeAdminApiPath("//api//admin//subscribers/")).toBe("/api/admin/subscribers");
    expect(classifyAdminApiPath("/api/admin/subscribers/")).toBe("machine_secret");
    expect(classifyAdminApiPath("/api/admin/stats")).toBe("browser_admin");
    expect(classifyAdminApiPath("/api/public")).toBe("not_admin");
  });

  it("authorizeAdminForRoute denies preview-host bypass for browser-admin routes", async () => {
    const res = await authorizeAdminForRoute(
      req("https://df1b2a48.mildmate-new.pages.dev/api/admin/stats"),
      { ADMIN_EMAILS: "admin@example.com" },
      "/api/admin/stats"
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(401);
  });

  it("authorizeAdminForRoute permits explicit machine secret only for machine route", async () => {
    const okMachine = await authorizeAdminForRoute(
      req("https://www.mildmate.com/api/admin/subscribers", { "X-Admin-Secret": "expected" }),
      { ADMIN_SECRET: "expected" },
      "/api/admin/subscribers"
    );
    expect(okMachine).toEqual({ ok: true });

    const deniedBrowser = await authorizeAdminForRoute(
      req("https://www.mildmate.com/api/admin/stats", { "X-Admin-Secret": "expected" }),
      { ADMIN_SECRET: "expected" },
      "/api/admin/stats"
    );
    expect(deniedBrowser.ok).toBe(false);
    if (!deniedBrowser.ok) expect(deniedBrowser.status).toBe(401);
  });
});
