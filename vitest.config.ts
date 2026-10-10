import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["workers/api/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
