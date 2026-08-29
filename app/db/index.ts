import { env } from "cloudflare:workers";

import { getDb } from "./client";

/** The Drizzle client bound to the request's D1 database. */
export function appDb() {
  return getDb(env.DB);
}

export * from "./queries";
