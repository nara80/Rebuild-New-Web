import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../admin-auth", () => ({
  authorizeAdminBrowser: vi.fn(),
}));

vi.mock("../email", () => ({
  sendEmail: vi.fn(),
}));

import { authorizeAdminBrowser } from "../admin-auth";
import { sendEmail } from "../email";
import { handleAdminBoatModels } from "../admin-boat-models";
import { handleAdminColorInventory } from "../admin-color-inventory";
import { handleAdminRecoveryTest } from "../admin-recovery-test";

const authMock = vi.mocked(authorizeAdminBrowser);
const sendEmailMock = vi.mocked(sendEmail);

describe("endpoint-specific auth guard fixes (R1)", () => {
  beforeEach(() => {
    authMock.mockReset();
    sendEmailMock.mockReset();
  });

  it("color-inventory denies unauthorized read and write", async () => {
    authMock.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });

    const getRes = await handleAdminColorInventory(
      new Request("https://www.mildmate.com/api/admin/color-inventory"),
      {} as any
    );
    expect(getRes.status).toBe(401);

    const putRes = await handleAdminColorInventory(
      new Request("https://www.mildmate.com/api/admin/color-inventory", {
        method: "PUT",
        body: JSON.stringify({ updates: [{ fabric: "a", color: "b", in_stock: 1 }] }),
        headers: { "Content-Type": "application/json" },
      }),
      {} as any
    );
    expect(putRes.status).toBe(401);
  });

  it("color-inventory returns data when authorized", async () => {
    authMock.mockResolvedValue({ ok: true });
    const env = {
      DB: {
        prepare: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [{ fabric: "breezeplus", color: "white", in_stock: 1, updated_at: "2026-10-22" }],
          })),
        })),
      },
    } as any;

    const res = await handleAdminColorInventory(
      new Request("https://www.mildmate.com/api/admin/color-inventory"),
      env
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(Array.isArray(body.inventory)).toBe(true);
    expect(body.inventory[0].fabric).toBe("breezeplus");
  });

  it("boat-models denies unauthorized access", async () => {
    authMock.mockResolvedValue({ ok: false, status: 403, error: "Forbidden" });
    const res = await handleAdminBoatModels(
      new Request("https://www.mildmate.com/api/admin/boat-models"),
      {} as any
    );
    expect(res.status).toBe(403);
  });

  it("recovery-test denies unauthorized POST", async () => {
    authMock.mockResolvedValue({ ok: false, status: 401, error: "Unauthorized" });
    const env = {
      RESEND_API_KEY: "rk",
      DB: { prepare: vi.fn() },
    } as any;

    const res = await handleAdminRecoveryTest(
      new Request("https://www.mildmate.com/api/admin/recovery-test", { method: "POST" }),
      env
    );
    expect(res.status).toBe(401);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("recovery-test keeps behavior for authorized admin (no eligible carts)", async () => {
    authMock.mockResolvedValue({ ok: true });
    const env = {
      RESEND_API_KEY: "rk",
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({ results: [] })),
          })),
        })),
      },
    } as any;

    const res = await handleAdminRecoveryTest(
      new Request("https://www.mildmate.com/api/admin/recovery-test", { method: "POST" }),
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.sent).toBe(0);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
