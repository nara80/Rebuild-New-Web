import { describe, expect, it } from "vitest";
import { handlePricing } from "../pricing";

type Row = { key: string; value: number };

class FakeDB {
  constructor(private rows: Row[]) {}
  prepare(sql: string) {
    const self = this;
    return {
      bind(..._args: any[]) {
        return this;
      },
      async all() {
        if (/SELECT key, value FROM pricing_params/i.test(sql)) {
          return { results: self.rows };
        }
        if (/SELECT key, value FROM pricing_params WHERE key LIKE/i.test(sql)) {
          return { results: self.rows.filter((r) => r.key.startsWith("derived_markup_")) };
        }
        return { results: [] };
      },
    };
  }
}

function req(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("pricing runtime params parity (fitted/family)", () => {
  it("uses live pricing_params for family fitted sheet (TH 7FT CloudSoft)", async () => {
    const env: any = {
      DB: new FakeDB([
        { key: "fabric_rate_cloudsoft", value: 100 },
        { key: "ops_rate", value: 15 },
        { key: "mkt_rate", value: 30 },
        { key: "margin_rate_standard", value: 40 },
        { key: "margin_rate_family", value: 70 },
        { key: "margin_rate_cushion_protector", value: 40 },
        { key: "delivery_cost", value: 70 },
        { key: "packing_cost", value: 100 },
        { key: "waste_factor_fabric", value: 20 },
        { key: "max_width_cm", value: 220 },
        { key: "sewing_tier1_max", value: 51600 },
        { key: "sewing_tier1_cost", value: 120 },
        { key: "sewing_tier2_max", value: 71000 },
        { key: "sewing_tier2_cost", value: 200 },
        { key: "sewing_tier3_max", value: 91200 },
        { key: "sewing_tier3_cost", value: 300 },
        { key: "sewing_tier4_max", value: 120000 },
        { key: "sewing_tier4_cost", value: 400 },
        { key: "sewing_tier5_max", value: 99999999 },
        { key: "sewing_tier5_cost", value: 500 },
      ]),
    };

    const response = await handlePricing(
      req("https://www.mildmate.com/api/pricing?product=family-fitted-sheet&fabric=cloudsoft&unit=cm&width=214&length=198&depth=46"),
      env
    );
    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.price_thb).toBe(2400);
    expect(body.breakdown.deliveryThb).toBe(70);
    expect(body.breakdown.marketingThb).toBeGreaterThan(0);
    expect(String(body.pricing_version || "")).toMatch(/^pp-/);
  });
});
