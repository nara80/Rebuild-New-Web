import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { verifyClerkJwt } from "../clerk-verify";
import { handleAdminAnalysis } from "../admin-analysis";

const verifyMock = vi.mocked(verifyClerkJwt);

function req(path: string): Request {
  return new Request("https://release-phase15-command-cent.mildmate-new.pages.dev" + path, {
    headers: { Authorization: "Bearer test.jwt" },
  });
}

function envWithDbError(message: string) {
  return {
    ADMIN_EMAILS: "admin@example.com",
    DB: {
      prepare: () => {
        throw new Error(message);
      },
    },
  } as any;
}

describe("admin-analysis unavailable contracts (preview schema gaps)", () => {
  beforeEach(() => {
    verifyMock.mockReset();
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "admin" }, email: "admin@example.com", sub: "user_1" },
    } as any);
  });

  it("returns available:false for missing opportunity schema", async () => {
    const res = await handleAdminAnalysis(req("/api/admin/analysis/opportunity"), envWithDbError("no such table: opportunity_score_models"));
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.available).toBe(false);
    expect(body.error_code).toBe("OPPORTUNITY_SCHEMA_UNAVAILABLE");
  });

  it("returns available:false for missing profitability views", async () => {
    const res = await handleAdminAnalysis(req("/api/admin/analysis/profitability"), envWithDbError("no such view: analysis_profit_orders"));
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.available).toBe(false);
    expect(body.error_code).toBe("PROFIT_VIEWS_MISSING");
  });

  it("returns available:false for missing quote pipeline schema", async () => {
    const res = await handleAdminAnalysis(req("/api/admin/analysis/quotes"), envWithDbError("no such column: o.quote_id"));
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.success).toBe(true);
    expect(body.available).toBe(false);
    expect(body.error_code).toBe("QUOTES_SCHEMA_UNAVAILABLE");
    expect(body.summary).toBe(null);
  });
});
