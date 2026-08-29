import { applyD1Migrations, env } from "cloudflare:test";

// Bring the local test D1 up to the current schema + seed before any test runs.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
