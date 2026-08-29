import type { D1Migration } from "@cloudflare/vitest-plugin";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    /** Injected by `vitest.workers.config.ts` from `drizzle/migrations/`. */
    TEST_MIGRATIONS: D1Migration[];
  }
}
