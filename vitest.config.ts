import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const appDir = fileURLToPath(new URL("./app", import.meta.url));

/**
 * Two test projects:
 *   - `unit`    : pure domain logic in `app/lib` + form parsing, plain Node, fast.
 *   - `workers` : D1-backed query-layer tests, run inside the Workers runtime
 *                 (see `vitest.workers.config.ts`).
 *
 * Coverage thresholds below apply to the domain layer only — that is the code
 * whose correctness the money math depends on.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { "~": appDir } },
        test: {
          name: "unit",
          include: ["app/**/*.test.ts"],
          environment: "node",
        },
      },
      "./vitest.workers.config.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["app/lib/**/*.ts"],
      exclude: ["app/lib/**/*.test.ts"],
      reportsDirectory: "./coverage",
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 95,
      },
    },
  },
});
