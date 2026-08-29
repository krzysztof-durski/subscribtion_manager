# Architecture

## Request flow

```
Browser
  │
  ▼
Cloudflare Access  ──►  adds Cf-Access-Authenticated-User-Email header
  │
  ▼
Worker (workers/app.ts)  ──►  React Router request handler (SSR)
  │
  ├─ route loader   ──►  app/db/queries.ts  ──►  Drizzle  ──►  D1
  │                       │
  │                       ▼
  │                  app/lib/*  (pure calculations)
  │
  └─ route action   ──►  app/forms.ts (parse) ──► app/db/queries.ts ──► D1 ──► redirect
```

Everything runs in one Worker: static assets and SSR are served by the same
deployment. There is no client-side data fetching — pages are server-rendered
and forms post back to route actions.

## Layers

| Path                | Responsibility                                                                                                                          | Depends on                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `app/lib/**`        | Pure domain logic: dates, billing schedules, refill dates, the sinking-fund pocket model, savings, money. No I/O, no framework imports. | nothing                      |
| `app/db/schema.ts`  | Drizzle table definitions (typed queries).                                                                                              | drizzle-orm                  |
| `app/db/queries.ts` | The only place that reads/writes D1. Maps rows ⇄ `app/lib` types.                                                                       | schema, `app/lib/types`      |
| `app/forms.ts`      | `FormData` → typed input or field errors. Pure.                                                                                         | `app/lib`, query input types |
| `app/routes/*.tsx`  | Thin loaders/actions + the UI. "read rows → build view model → render" and "parse → write → redirect".                                  | everything above             |
| `app/ui.tsx`        | Presentational components.                                                                                                              | react-router                 |

The dependency arrow only points downward. `app/lib` never imports from
`app/db` or `react-router`, which is what lets it be unit-tested in plain Node
at 100% coverage.

## Data model (4 tables)

- **currencies** — `code` PK, `rate_to_base` (base-currency units per 1 unit;
  the base row is 1), `is_base`. Rates are entered by hand on the Settings page;
  no history.
- **pockets** — a Revolut pocket. Holds one `currency_code`. Optional
  `refill_day` overrides `settings.default_refill_day`.
- **subscriptions** — `amount_minor` in the currency's minor units,
  `interval_months`, `first_billing_date` (anchor + earliest charge),
  `billing_day`, optional `end_date`, `active`. Belongs to one pocket; its
  currency is the pocket's currency.
- **settings** — single row (`id = 1`): base currency, default refill day,
  timezone, monthly income and food (base-currency minor units).

Money is always integer minor units. Dates are `YYYY-MM-DD` text and sorted as
strings. "Today" is resolved once per request from `settings.timezone`.

## Migrations

Hand-authored SQL in `drizzle/migrations/` is the source of truth for the
database _shape_; `app/db/schema.ts` is the source of truth for _typed queries_.
Keep them in sync when either changes. Apply with
`npm run db:migrate:local` / `:remote` (wrangler tracks applied migrations in
`d1_migrations`). The test suite reads the same SQL files via
`readD1Migrations` and applies them to an in-memory D1.

## Routes

| Path             | Purpose                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`              | Dashboard: per-pocket expected balance, monthly refill, next refill date, the charges due before that refill, PLN grand total. `?today=` overrides the date. |
| `/subscriptions` | List + create / edit / delete.                                                                                                                               |
| `/pockets`       | List + create / edit / delete (blocked while subscriptions reference it).                                                                                    |
| `/settings`      | Default refill day, timezone, income, food; currency list + exchange rates.                                                                                  |
| `/savings`       | `income − subscriptions(PLN) − food`, with a per-subscription breakdown. Also edits income/food.                                                             |

## Tests

- **`unit` project** (`app/**/*.test.ts`, plain Node) — the domain layer and
  form parsing. `app/lib/**` is held at 100% line/function/statement coverage
  and 95% branch coverage (`vitest.config.ts`).
- **`workers` project** (`test/**`, Workers runtime) — `app/db/queries.ts`
  against a real migrated D1, including an end-to-end reproduction of the
  canonical dashboard number.
