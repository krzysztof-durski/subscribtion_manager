/**
 * Replace the local D1 database with an exact copy of production.
 *
 * `wrangler d1 export` does not reliably pick up `account_id` from wrangler.jsonc
 * and can fail without a non-zero exit, so this script sets the account id
 * explicitly, checks the dump exists and is non-empty, and only then wipes and
 * reloads the local database.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";

const DB = "subscription-manager";
const DUMP = ".wrangler/remote-dump.sql";

// account_id from wrangler.jsonc, so the two never drift.
const wrangler = readFileSync("wrangler.jsonc", "utf8");
const accountId = /"account_id":\s*"([0-9a-f]{32})"/.exec(wrangler)?.[1];
if (!accountId) throw new Error("account_id not found in wrangler.jsonc");

const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, WRANGLER_SEND_METRICS: "false" };
const run = (args) => execFileSync("npx", ["wrangler", ...args], { stdio: "inherit", env });

rmSync(DUMP, { force: true });

console.log(`\n→ exporting production ${DB} …`);
run(["d1", "export", DB, "--remote", `--output=${DUMP}`]);

if (!existsSync(DUMP) || statSync(DUMP).size < 100) {
  throw new Error(`export produced no usable dump at ${DUMP} — aborting before touching local`);
}

console.log("\n→ resetting local database …");
rmSync(".wrangler/state/v3/d1", { recursive: true, force: true });
run(["d1", "execute", DB, "--local", `--file=${DUMP}`]);

console.log("\n✓ local D1 now mirrors production");
