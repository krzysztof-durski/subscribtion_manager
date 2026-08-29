import { fileURLToPath } from "node:url";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

/**
 * The `workers` test project: runs inside the Workers runtime with a real local
 * D1 database. Migrations from `drizzle/migrations/` are read at config time and
 * handed to the runtime as a binding, then applied in `test/apply-migrations.ts`.
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations("drizzle/migrations");

  return {
    resolve: {
      alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
    },
    test: {
      name: "workers",
      include: ["test/**/*.test.ts"],
      setupFiles: ["test/apply-migrations.ts"],
    },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
  };
});
