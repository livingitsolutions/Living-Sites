import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@livingsites/domain": new URL("./packages/domain/src/index.ts", import.meta.url).pathname,
      "@livingsites/application": new URL("./packages/application/src/index.ts", import.meta.url).pathname,
      "@livingsites/platform": new URL("./packages/platform/src/index.ts", import.meta.url).pathname,
      "@livingsites/infrastructure": new URL("./packages/infrastructure/src/index.ts", import.meta.url).pathname,
      "@livingsites/test-support": new URL("./packages/test-support/src/index.ts", import.meta.url).pathname,
      "@livingsites/composition": new URL("./packages/composition/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "packages/**/*.test.{ts,tsx}",
      "app/**/*.test.{ts,tsx}",
      "netlify/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
