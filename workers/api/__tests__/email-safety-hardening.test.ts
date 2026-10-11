import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { sendEmail, evaluateOutboundEmailSafety } from "../email";
import { handleStripeWebhook } from "../webhook";
import { scheduled } from "../../../functions/cron";
import { handleAdminThankyouDispatch } from "../admin-thankyou-dispatch";

async function signStripePayload(payload: string, secret: string): Promise<string> {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const content = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

class CronFakeDB {
  updates: string[] = [];
  prepare(sql: string) {
    const db = this;
    const stmt: any = {
      bind() {
        return stmt;
      },
      async first() {
        const q = sql.toLowerCase();
        if (q.includes("count(*) as cnt from abandoned_carts")) return { cnt: 0 };
        return null;
      },
      async all() {
        const q = sql.toLowerCase();
        if (q.includes("select key, value from recovery_config")) return { results: [] };
        if (q.includes("where recovered = 0 and recovery_stage = 0")) {
          return {
            results: [
              {
                id: 1,
                email: "stage-user@example.com",
                cart_json: JSON.stringify([
                  {
                    product_name: "Standard Fitted Sheet",
                    fabric: "cloudsoft",
                    color: "white",
                    dimensions: { w: 150, l: 200, d: 30, unit: "cm" },
                    price_usd: 120,
                    price_thb: 4200,
                    qty: 1,
                  },
                ]),
              },
            ],
          };
        }
        if (q.includes("where recovered = 0 and recovery_stage = 1")) return { results: [] };
        if (q.includes("where recovered = 0 and recovery_stage = 2")) return { results: [] };
        if (q.includes("from thankyou_queue where sent = 0")) {
          return {
            results: [
              { id: 9, order_id: "cs_stage_1", email: "stage-user@example.com", discount_code: "THANKS-ABC123", discount_pct: 20 },
            ],
          };
        }
        return { results: [] };
      },
      async run() {
        db.updates.push(sql);
        return { success: true, meta: { changes: 1 } };
      },
    };
    return stmt;
  }
}

class AdminDispatchFakeDB {
  updates: string[] = [];
  prepare(sql: string) {
    const db = this;
    const stmt: any = {
      bind() {
        return stmt;
      },
      async first() {
        const q = sql.toLowerCase();
        if (q.includes("from discount_claims")) return { status: "issued", expires_at: "2099-01-01 00:00:00" };
        return null;
      },
      async all() {
        const q = sql.toLowerCase();
        if (q.includes("pragma table_info(thankyou_queue)")) {
          return { results: [{ name: "id" }, { name: "sent_at" }, { name: "last_error" }] };
        }
        if (q.includes("from thankyou_queue where sent = 0")) {
          return {
            results: [
              { id: 5, order_id: "cs_stage_2", email: "buyer@example.com", discount_code: "THANKS-999", discount_pct: 20, send_after: "2026-01-01 00:00:00" },
            ],
          };
        }
        return { results: [] };
      },
      async run() {
        db.updates.push(sql);
        return { success: true, meta: { changes: 1 } };
      },
    };
    return stmt;
  }
}

describe("staging email isolation hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("blocks non-production outbound email when NON_PROD_EMAIL_ALLOWED=false", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as any);
    const result = await sendEmail(
      {
        RESEND_API_KEY: "re_test_123",
        RUNTIME_ENV: "staging",
        D1_ENV_LABEL: "staging",
        STRIPE_ENV_MODE: "test",
        NON_PROD_EMAIL_ALLOWED: "false",
      },
      { to: "buyer@example.com", subject: "Test", text: "Hello" }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("EMAIL_SUPPRESSED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed on missing non-production email flag", async () => {
    const decision = evaluateOutboundEmailSafety({
      RUNTIME_ENV: "staging",
      D1_ENV_LABEL: "staging",
      STRIPE_ENV_MODE: "test",
      RESEND_API_KEY: "re_test_123",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("missing_non_prod_email_allowed");
  });

  it("blocks contradictory staging signals even when STRIPE_ENV_MODE=live", () => {
    const decision = evaluateOutboundEmailSafety({
      RUNTIME_ENV: "staging",
      D1_ENV_LABEL: "staging",
      STRIPE_ENV_MODE: "live",
      NON_PROD_EMAIL_ALLOWED: "true",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("environment_signal_conflict");
  });

  it("keeps explicit NON_PROD_EMAIL_ALLOWED=false dominant under contradictory signals", () => {
    const decision = evaluateOutboundEmailSafety({
      RUNTIME_ENV: "staging",
      D1_ENV_LABEL: "staging",
      STRIPE_ENV_MODE: "live",
      NON_PROD_EMAIL_ALLOWED: "false",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("non_prod_email_explicitly_blocked");
  });

  it("keeps production email behavior unchanged", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "re_msg_1" }),
    }));
    vi.stubGlobal("fetch", fetchMock as any);
    const result = await sendEmail(
      {
        RESEND_API_KEY: "re_live_123",
        RUNTIME_ENV: "production",
        D1_ENV_LABEL: "prod",
        STRIPE_ENV_MODE: "live",
      },
      { to: "buyer@example.com", subject: "Prod", text: "Hello" }
    );
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not disable legitimate production email when NON_PROD_EMAIL_ALLOWED=false is present", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "re_msg_2" }),
    }));
    vi.stubGlobal("fetch", fetchMock as any);
    const result = await sendEmail(
      {
        RESEND_API_KEY: "***********",
        RUNTIME_ENV: "production",
        D1_ENV_LABEL: "prod",
        STRIPE_ENV_MODE: "live",
        NON_PROD_EMAIL_ALLOWED: "false",
      },
      { to: "buyer@example.com", subject: "Prod 2", text: "Hello" }
    );
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prevents webhook email side effects in staging even when paid/refund event arrives", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as any);
    const event = {
      id: "evt_refund_1",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_123",
          amount: 9900,
          currency: "usd",
          receipt_email: "buyer@example.com",
          payment_method_details: { card: { brand: "visa", last4: "4242" } },
          refunds: { data: [{ reason: "requested_by_customer" }] },
        },
      },
    };
    const body = JSON.stringify(event);
    const signature = await signStripePayload(body, "whsec_stage");
    const req = new Request("https://preview.mildmate-new.pages.dev/api/webhook/stripe", {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": signature },
      body,
    });
    const resp = await handleStripeWebhook(req, {
      DB: {} as any,
      STRIPE_WEBHOOK_SECRET: "whsec_stage",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_ENV_MODE: "test",
      NON_PROD_STRIPE_ALLOWED: "true",
      RUNTIME_ENV: "staging",
      D1_ENV_LABEL: "staging",
      NON_PROD_EMAIL_ALLOWED: "false",
      RESEND_API_KEY: "re_test_123",
      ORDER_NOTIFICATION_EMAIL: "ops@example.com",
    });
    expect(resp.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("staging cron does not send abandoned-cart or thank-you emails", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as any);
    const db = new CronFakeDB();
    await scheduled({} as any, {
      DB: db as any,
      RESEND_API_KEY: "re_test_123",
      RUNTIME_ENV: "staging",
      D1_ENV_LABEL: "staging",
      STRIPE_ENV_MODE: "test",
      NON_PROD_EMAIL_ALLOWED: "false",
    } as any, {} as any);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.updates.length).toBe(0);
  });

  it("staging admin thankyou dispatch cannot bypass guard", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as any);
    const db = new AdminDispatchFakeDB();
    const req = new Request("https://preview.mildmate-new.pages.dev/api/admin/thankyou-dispatch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit: 1 }),
    });
    const resp = await handleAdminThankyouDispatch(req, {
      DB: db as any,
      RESEND_API_KEY: "re_test_123",
      NON_PROD_EMAIL_ALLOWED: "false",
      RUNTIME_ENV: "staging",
      D1_ENV_LABEL: "staging",
      STRIPE_ENV_MODE: "test",
    });
    const json = await resp.json() as any;
    expect(resp.status).toBe(200);
    expect(json.sent).toBe(0);
    expect(json.failed).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.updates.some((sql) => /set sent = 1/i.test(sql))).toBe(false);
  });

  it("keeps checkout free of outbound email calls", () => {
    const checkoutSrc = readFileSync("D:\\00_mildmate\\re-build_web\\workers\\api\\checkout.ts", "utf8");
    expect(checkoutSrc.includes("api.resend.com")).toBe(false);
    expect(checkoutSrc.includes("sendEmail(")).toBe(false);
  });

  it("enforces centralized resend usage (no direct API calls in app paths)", () => {
    const cronSrc = readFileSync("D:\\00_mildmate\\re-build_web\\functions\\cron.ts", "utf8");
    const dispatchSrc = readFileSync("D:\\00_mildmate\\re-build_web\\workers\\api\\admin-thankyou-dispatch.ts", "utf8");
    const recoveryTestSrc = readFileSync("D:\\00_mildmate\\re-build_web\\workers\\api\\admin-recovery-test.ts", "utf8");
    const webhookSrc = readFileSync("D:\\00_mildmate\\re-build_web\\workers\\api\\webhook.ts", "utf8");
    expect(cronSrc.includes("api.resend.com")).toBe(false);
    expect(dispatchSrc.includes("api.resend.com")).toBe(false);
    expect(recoveryTestSrc.includes("api.resend.com")).toBe(false);
    expect(webhookSrc.includes("api.resend.com")).toBe(false);
  });
});
