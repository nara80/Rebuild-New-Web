import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const commandCenterHtml = fs.readFileSync(
  path.resolve(process.cwd(), "public/super-admin/marketing/index.html"),
  "utf8"
);

describe("Phase 16 AI Analyst Command Center UI contract", () => {
  it("keeps runtime mirrors in parity (index.js + _worker.js)", () => {
    const indexJs = fs.readFileSync(path.resolve(process.cwd(), "public/index.js"), "utf8");
    const workerJs = fs.readFileSync(path.resolve(process.cwd(), "public/_worker.js"), "utf8");
    expect(indexJs).toContain("handleAdminAiAnalyst");
    expect(indexJs).toContain("/api/admin/ai-analyst");
    expect(workerJs).toContain("handleAdminAiAnalyst");
  });

  it("renders the AI Analyst advisory panel with explicit boundaries", () => {
    expect(commandCenterHtml).toContain("AI Analyst (Phase 16)");
    expect(commandCenterHtml).toContain("Advisory Only");
    expect(commandCenterHtml).toContain("id=\"ai-recommend-btn\"");
    expect(commandCenterHtml).toContain("id=\"ai-actions-table\"");
    expect(commandCenterHtml).toContain("id=\"ai-review-form\"");
    expect(commandCenterHtml).toContain("Human approval required");
  });

  it("wires the panel to the ai-analyst API with approval/review workflow", () => {
    expect(commandCenterHtml).toContain("'/api/admin/ai-analyst'");
    expect(commandCenterHtml).toContain("generateAiRecommendations");
    expect(commandCenterHtml).toContain("op: 'approve'");
    expect(commandCenterHtml).toContain("op: 'reject'");
    expect(commandCenterHtml).toContain("op: 'review'");
    expect(commandCenterHtml).toContain("AI provider not configured");
  });

  it("keeps the AI advisory guardrails visible (no auto-execution)", () => {
    expect(commandCenterHtml).toContain("AI never executes actions or spends budgets");
    expect(commandCenterHtml).toContain("Reviewed / Results");
  });
});
