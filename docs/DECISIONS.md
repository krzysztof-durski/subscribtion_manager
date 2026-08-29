# Decisions

Short records of choices that aren't obvious from the code. Format: context →
decision → consequences.

## Workers, not Pages

**Context.** The app targets Cloudflare with a D1 database, behind Zero Trust.
Cloudflare Pages was the original idea.

**Decision.** Build as a Worker with static assets (React Router framework mode
via `@cloudflare/vite-plugin`).

**Consequences.** As of 2026 Cloudflare recommends Workers for new full-stack
apps — full feature parity with Pages, and Access/Zero-Trust is first-class on
Workers. One deployment serves both the SSR app and its assets. `npm run deploy`
does `wrangler deploy`; there is no Pages project.

## Sinking-fund pocket model, not just-in-time

**Context.** "How much should be in the pocket now?" can mean "enough to cover
charges until the next refill" (just-in-time) or "the monthly-equivalent set
aside since the last charge" (sinking fund).

**Decision.** Sinking fund. See [`POCKET-MODEL.md`](POCKET-MODEL.md).

**Consequences.** The monthly transfer into each pocket is constant, and the
expected balance is a meaningful target to reconcile against the real Revolut
balance. Monthly subscriptions behave identically under both models; only
multi-month subscriptions differ. The model assumes steady-state saving since a
subscription's last charge — a per-subscription "funded since" override is a
possible future refinement.

## Money as integer minor units

**Context.** Financial app, multiple currencies, exchange-rate multiplication.

**Decision.** Every amount is an integer count of minor units (grosze,
eurocents). Rounding is explicit and happens once per boundary
(`Math.round` in `toBaseMinor`, `monthlyEquivalentMinor`). No floats in stored
or accumulated values.

**Consequences.** All currencies are assumed to have 2 decimal places (true for
PLN/EUR/USD). A zero-decimal or three-decimal currency would need work in
`money.ts` and the parsers.

## Manual exchange rates, no history

**Context.** Rates change; the user wants control and no external dependencies
(the app is fully behind Access with no outbound calls).

**Decision.** One current `rate_to_base` per currency, edited on the Settings
page. No historical rates.

**Consequences.** Pocket balances need no conversion (a pocket is single-
currency), so this only affects the savings page and the dashboard's PLN grand
total, which always use the current rate. Past figures shift if a rate is
changed — acceptable for a personal steady-state view.

## Billing day is derived, not entered

**Context.** Early on, a subscription had both a `first_billing_date` (the
anchor) and a separate `billing_day`. A row was created where they disagreed by
one day (date on the 27th, billing day 26). The 26th occurrence in the anchor
month sorts _before_ the anchor, so `billingOccurrencesBetween` filtered it out
and the schedule jumped a full year ahead — the sinking-fund balance showed a
full charge instead of a partial one.

**Decision.** Drop the separate field. `billing_day` is always the day-of-month
of `first_billing_date` (set in `parseSubscriptionForm`; existing rows realigned
by `0002_align_billing_day.sql`). The column stays for query convenience.

**Consequences.** You can no longer express "started on the 3rd, bills on the
1st" — set `first_billing_date` to a representative charge date instead.
`schedule.ts` still tolerates a mismatched `billing_day` (direct DB edits) but
the app never produces one.

## Date-only schedule math

**Context.** Billing and refill schedules are "day of month, every N months".
Workers run in UTC; the user is in Europe/Warsaw.

**Decision.** All schedule math operates on `YYYY-MM-DD` strings. "Today" is the
only timezone-dependent value, resolved once per request via `Intl` from
`settings.timezone`.

**Consequences.** No DST or offset bugs are possible in the calculations — only
month-length clamping, which `daysInMonth` handles. String comparison is
chronological order.

## Hand-written migrations + Drizzle for queries

**Context.** `drizzle-kit generate` can produce migrations, but its journal
doesn't mix well with hand-added seed migrations, and SQLite `CHECK`
constraints round-trip awkwardly.

**Decision.** Author migration SQL by hand in `drizzle/migrations/`; use
drizzle-orm only as the typed query builder. `app/db/schema.ts` and the SQL are
kept in sync manually.

**Consequences.** Full control over DDL and seed data; the schema file and
migrations must be updated together (noted in `ARCHITECTURE.md`).
