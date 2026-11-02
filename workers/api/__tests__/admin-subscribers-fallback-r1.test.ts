import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("subscribers secret fallback hardening (R1)", () => {
  it("removes default ADMIN_SECRET fallback from live router source", () => {
    const file = join(process.cwd(), "functions", "api", "[[path]].ts");
    const text = readFileSync(file, "utf8");
    expect(text.includes('env.ADMIN_SECRET || "admin"')).toBe(false);
  });
});
