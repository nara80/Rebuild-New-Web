import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { verifyClerkJwt } from "../clerk-verify";
import { authorizeAdminForRoute } from "../admin-auth";

const verifyMock = vi.mocked(verifyClerkJwt);

function req(method: string, path: string, headers?: Record<string, string>): Request {
  return new Request(`https://www.mildmate.com${path}`, {
    method,
    headers: headers || {},
  });
}

const ADMIN_ROUTE_METHODS: Record<string, string[]> = {
  "/api/admin/upload": ["POST", "DELETE"],
  "/api/admin/products": ["GET", "POST", "PUT"],
  "/api/admin/orders": ["GET", "PUT"],
  "/api/admin/customers": ["GET"],
  "/api/admin/stats": ["GET"],
  "/api/admin/analysis/data-quality": ["POST"],
  "/api/admin/cost-model": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/shipping-rates": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/shipping-product-tiers": ["GET", "PUT"],
  "/api/admin/shipping-add-rates": ["GET", "PUT"],
  "/api/admin/quotes": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/promo": ["GET", "POST", "DELETE"],
  "/api/admin/boat-models": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/blog": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/reviews": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/recovery-test": ["POST"],
  "/api/admin/offers": ["GET", "POST", "PUT"],
  "/api/admin/campaigns": ["GET", "POST", "DELETE"],
  "/api/admin/color-inventory": ["GET", "PUT"],
  "/api/admin/accounts": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/thankyou-dispatch": ["POST"],
  "/api/admin/favorites/stats": ["GET"],
  "/api/admin/contacts": ["GET", "POST"],
  "/api/admin/pricing-params": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/diy-prices": ["GET", "POST", "PUT", "DELETE"],
  "/api/admin/exchange-rates": ["GET", "POST", "PUT"],
  "/api/admin/subscribers": ["GET", "DELETE"],
};

describe("admin route matrix authorization (R1)", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("denies anonymous access for every admin route/method", async () => {
    const env = { ADMIN_SECRET: "expected" };
    for (const [path, methods] of Object.entries(ADMIN_ROUTE_METHODS)) {
      for (const method of methods) {
        const res = await authorizeAdminForRoute(req(method, path), env, path);
        expect(res.ok, `anonymous should be denied: ${method} ${path}`).toBe(false);
      }
    }
  });

  it("denies invalid/expired JWTs on browser-admin routes", async () => {
    verifyMock.mockResolvedValue({ valid: false, status: 401, error: "Token expired" } as any);
    const browserPath = "/api/admin/stats";
    const res = await authorizeAdminForRoute(
      req("GET", browserPath, { Authorization: "Bearer invalid.jwt" }),
      { ADMIN_EMAILS: "admin@example.com" },
      browserPath
    );
    expect(res).toEqual({ ok: false, status: 401, error: "Token expired" });
  });

  it("allows authorized admin/super-admin for browser-admin routes", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "super-admin" }, email: "admin@example.com", sub: "user_1" },
    } as any);

    const env = { ADMIN_EMAILS: "admin@example.com" };
    const browserPath = "/api/admin/stats";
    const res = await authorizeAdminForRoute(
      req("GET", browserPath, { Authorization: "Bearer valid.jwt" }),
      env,
      browserPath
    );
    expect(res).toEqual({ ok: true });
  });

  it("allows explicit machine secret only for approved machine route", async () => {
    const env = { ADMIN_SECRET: "expected" };

    const machineOk = await authorizeAdminForRoute(
      req("GET", "/api/admin/subscribers", { "X-Admin-Secret": "expected" }),
      env,
      "/api/admin/subscribers"
    );
    expect(machineOk).toEqual({ ok: true });

    const nonMachineDenied = await authorizeAdminForRoute(
      req("GET", "/api/admin/stats", { "X-Admin-Secret": "expected" }),
      env,
      "/api/admin/stats"
    );
    expect(nonMachineDenied.ok).toBe(false);
  });

  it("denies missing/incorrect machine secret", async () => {
    const path = "/api/admin/subscribers";
    const missing = await authorizeAdminForRoute(req("GET", path), { ADMIN_SECRET: "expected" }, path);
    expect(missing.ok).toBe(false);

    const wrong = await authorizeAdminForRoute(
      req("GET", path, { "X-Admin-Secret": "wrong" }),
      { ADMIN_SECRET: "expected" },
      path
    );
    expect(wrong.ok).toBe(false);
  });

  it("does not bypass on preview/hashed pages.dev hostnames", async () => {
    const path = "/api/admin/stats";
    const previewReq = new Request(`https://mildmate-new.pages.dev${path}`);
    const hashedReq = new Request(`https://df1b2a48.mildmate-new.pages.dev${path}`);

    const previewRes = await authorizeAdminForRoute(previewReq, { ADMIN_EMAILS: "admin@example.com" }, path);
    const hashedRes = await authorizeAdminForRoute(hashedReq, { ADMIN_EMAILS: "admin@example.com" }, path);

    expect(previewRes.ok).toBe(false);
    expect(hashedRes.ok).toBe(false);
  });

  it("treats encoded/alternate admin path variants as protected", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "admin" }, email: "admin@example.com", sub: "user_1" },
    } as any);
    const env = { ADMIN_EMAILS: "admin@example.com" };

    const encoded = await authorizeAdminForRoute(
      req("GET", "/api/admin/%73tats", { Authorization: "Bearer valid.jwt" }),
      env,
      "/api/admin/%73tats"
    );
    expect(encoded).toEqual({ ok: true });

    const noAuthAltSlash = await authorizeAdminForRoute(
      req("GET", "//api//admin//stats/"),
      env,
      "//api//admin//stats/"
    );
    expect(noAuthAltSlash.ok).toBe(false);
  });
});
