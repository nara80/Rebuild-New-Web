import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit regression (2026-11-01): the live Pages router
// (functions/api/[[path]].ts) never registered /api/admin/templates —
// authorized requests passed the central admin gate and fell through to
// 404, while the template editor only sent X-Admin-Secret (rejected by the
// browser_admin gate). These tests pin the route registration and the
// auth/authorization behavior end-to-end through the router's onRequest.

vi.mock("../clerk-verify", () => ({
  verifyClerkJwt: vi.fn(),
}));

import { verifyClerkJwt } from "../clerk-verify";
import { onRequest as routerOnRequest } from "../../../functions/api/[[path]]";

const verifyMock = vi.mocked(verifyClerkJwt);

const VALID_CLAIMS = {
  valid: true,
  payload: { raw: { role: "admin" }, email: "admin@example.com", sub: "user_1" },
} as any;

const ADMIN_ENV = { ADMIN_EMAILS: "admin@example.com" };

class TemplatesD1 {
  statements: string[] = [];
  mutations = 0;
  rows = [
    { template_key: "footer-standard", template_html: "<footer>OLD</footer>", updated_at: "2026-01-01T00:00:00Z" },
    { template_key: "header-standard", template_html: "<header>OLD</header>", updated_at: "2026-01-01T00:00:00Z" },
  ];

  prepare(sql: string) {
    const self = this;
    return {
      all: async () => {
        self.statements.push(sql);
        return { results: self.rows.map((r) => ({ ...r })) };
      },
      bind(..._args: any[]) {
        return {
          run: async () => {
            self.mutations += 1;
            self.statements.push(sql);
            return { success: true };
          },
        };
      },
    };
  }

  reset() {
    this.statements = [];
    this.mutations = 0;
  }
}

function routerRequest(
  method: string,
  path: string,
  headers?: Record<string, string>,
  body?: unknown
): Request {
  return new Request(`https://www.mildmate.com${path}`, {
    method,
    headers: headers || {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function runRouter(request: Request, env: any): Promise<Response> {
  return (routerOnRequest as any)({ request, env, params: {} });
}

describe("admin templates route — live Pages router (R1 audit regression)", () => {
  let db: TemplatesD1;

  beforeEach(() => {
    verifyMock.mockReset();
    db = new TemplatesD1();
    vi.unstubAllGlobals();
  });

  it("registers /api/admin/templates: authorized GET returns templates from D1", async () => {
    verifyMock.mockResolvedValue(VALID_CLAIMS);
    const res = await runRouter(
      routerRequest("GET", "/api/admin/templates", { Authorization: "Bearer valid.jwt" }),
      { ...ADMIN_ENV, DB: db }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.templates)).toBe(true);
    expect(json.templates.map((t: any) => t.template_key).sort()).toEqual([
      "footer-standard",
      "header-standard",
    ]);
    expect(db.statements.some((s) => s.includes("SELECT template_key, template_html, updated_at"))).toBe(true);
    expect(db.mutations).toBe(0);
  });

  it("trailing-slash variant also reaches the handler", async () => {
    verifyMock.mockResolvedValue(VALID_CLAIMS);
    const res = await runRouter(
      routerRequest("GET", "/api/admin/templates/", { Authorization: "Bearer valid.jwt" }),
      { ...ADMIN_ENV, DB: db }
    );
    expect(res.status).toBe(200);
  });

  it("rejects anonymous GET at the gate — D1 never queried", async () => {
    const res = await runRouter(
      routerRequest("GET", "/api/admin/templates"),
      { ...ADMIN_ENV, DB: db }
    );
    expect(res.status).toBe(401);
    expect(db.statements.length).toBe(0);
    expect(db.mutations).toBe(0);
  });

  it("rejects X-Admin-Secret-only requests — browser_admin route requires Clerk bearer", async () => {
    const res = await runRouter(
      routerRequest("GET", "/api/admin/templates", { "X-Admin-Secret": "expected" }),
      { ...ADMIN_ENV, ADMIN_SECRET: "expected", DB: db }
    );
    expect(res.status).toBe(401);
    expect(db.statements.length).toBe(0);
    expect(db.mutations).toBe(0);
  });

  it("rejects invalid JWTs — D1 never queried", async () => {
    verifyMock.mockResolvedValue({ valid: false, status: 401, error: "Token expired" } as any);
    const res = await runRouter(
      routerRequest("GET", "/api/admin/templates", { Authorization: "Bearer invalid.jwt" }),
      { ...ADMIN_ENV, DB: db }
    );
    expect(res.status).toBe(401);
    expect(db.statements.length).toBe(0);
    expect(db.mutations).toBe(0);
  });

  it("rejects Clerk users without admin role/allowlisted email — D1 never queried", async () => {
    verifyMock.mockResolvedValue({
      valid: true,
      payload: { raw: { role: "user" }, email: "customer@example.com", sub: "user_2" },
    } as any);
    const res = await runRouter(
      routerRequest("GET", "/api/admin/templates", { Authorization: "Bearer valid.jwt" }),
      { ...ADMIN_ENV, DB: db }
    );
    expect(res.status).toBe(403);
    expect(db.statements.length).toBe(0);
    expect(db.mutations).toBe(0);
  });

  it("authorized PUT with a disallowed template key → 400 with no DB mutation", async () => {
    verifyMock.mockResolvedValue(VALID_CLAIMS);
    const res = await runRouter(
      routerRequest(
        "PUT",
        "/api/admin/templates",
        { Authorization: "Bearer valid.jwt", "Content-Type": "application/json" },
        { key: "nav-standard", html: "<nav>EVIL</nav>" }
      ),
      { ...ADMIN_ENV, DB: db }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid template key");
    expect(db.mutations).toBe(0);
  });

  it("authorized PUT with allowed key updates the template exactly once", async () => {
    verifyMock.mockResolvedValue(VALID_CLAIMS);
    const res = await runRouter(
      routerRequest(
        "PUT",
        "/api/admin/templates",
        { Authorization: "Bearer valid.jwt", "Content-Type": "application/json" },
        { key: "header-standard", html: "<header>NEW</header>" }
      ),
      { ...ADMIN_ENV, DB: db }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, key: "header-standard" });
    expect(db.mutations).toBe(1);
    expect(db.statements.some((s) => s.includes("INSERT OR REPLACE INTO site_templates"))).toBe(true);
  });

  it("PUT without bearer (secret only) never reaches the handler — no DB mutation", async () => {
    const res = await runRouter(
      routerRequest(
        "PUT",
        "/api/admin/templates",
        { "X-Admin-Secret": "expected", "Content-Type": "application/json" },
        { key: "header-standard", html: "<header>HACKED</header>" }
      ),
      { ...ADMIN_ENV, ADMIN_SECRET: "expected", DB: db }
    );
    expect(res.status).toBe(401);
    expect(db.mutations).toBe(0);
    expect(db.statements.length).toBe(0);
  });
});
