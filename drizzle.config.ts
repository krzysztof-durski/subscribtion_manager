import { defineConfig } from "drizzle-kit";

/**
 * Drizzle is used as the typed query builder for D1. Migrations are hand-authored
 * SQL under `drizzle/migrations/` (applied with `wrangler d1 migrations apply`),
 * so this config exists mainly for `drizzle-kit studio` and for `drizzle-kit
 * generate` when cross-checking the schema against the migrations.
 */
export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
