# Subscription Manager

A personal, single-user app for tracking recurring subscriptions across
currencies and answering two questions:

1. **How much should be in each of my Revolut pockets right now?**
2. **How much am I saving each month?** (`income − subscriptions in PLN − food`)

It runs as a Cloudflare Worker with a D1 database, behind Cloudflare Access
(Zero Trust) — so the app itself has no login.

- **Live:** <https://subscribtion-manager.codepapa.xyz> (the `*.workers.dev` URL is disabled)
- **Stack:** React Router v7 (framework mode) on Workers, D1 + Drizzle, Tailwind.
- **The interesting bit** — how "should be in the pocket now" is computed —
  is written up in [`docs/POCKET-MODEL.md`](docs/POCKET-MODEL.md).
- Architecture overview: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- Design decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Local development

```bash
npm install
npm run db:migrate:local   # apply migrations + seed to local D1
npm run dev                # http://localhost:5173
```

The D1 database (`subscription-manager`, id in `wrangler.jsonc`) already exists on
the personal Cloudflare account, which `account_id` in `wrangler.jsonc` pins every
`wrangler` command to.

The seed adds PLN / EUR / USD with placeholder exchange rates and an empty
settings row. Set real rates, your refill day, income and food on the
**Settings** page.

### Checking the pocket math

The dashboard accepts a `?today=YYYY-MM-DD` query parameter that overrides
"today", so you can verify balances against a hand calculation without changing
the clock, e.g. `http://localhost:5173/?today=2026-08-15`.

## Scripts

| Script                                 | What it does                                             |
| -------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                          | Dev server (Workers runtime + HMR)                       |
| `npm test`                             | Full test suite (unit + D1 integration)                  |
| `npm run coverage`                     | Tests with coverage (domain layer must stay at 100%)     |
| `npm run typecheck`                    | `wrangler types` + `react-router typegen` + `tsc -b`     |
| `npm run lint` / `npm run format`      | ESLint / Prettier                                        |
| `npm run check`                        | typecheck + lint + format check + coverage (the CI gate) |
| `npm run db:migrate:local` / `:remote` | Apply migrations to local / production D1                |
| `npm run db:studio`                    | Drizzle Studio against the schema                        |
| `npm run deploy`                       | Build and deploy the Worker                              |

## Deploying

Already deployed once. To ship an update:

```bash
npm run db:migrate:remote     # only if there are new migrations
npm run deploy                # build + wrangler deploy
```

### Cloudflare Access (Zero Trust)

Configured as a **self-hosted application** in Zero Trust → Access → Applications:

- Destinations: the public hostname `subscribtion-manager.codepapa.xyz` **and**
  the `subscription-manager` Worker.
- Policy: **Allow** → Emails → `dursky.k@gmail.com`.
- Login: email one-time code by default; a passkey can be registered on first
  sign-in.

The app has no auth of its own — it just reads the
`Cf-Access-Authenticated-User-Email` header Access adds, and shows it in the nav.
Local `npm run dev` has no gate.

## Backups

D1 **Time Travel** gives automatic point-in-time recovery (7 days on the free
plan). For an off-platform copy:

```bash
npx wrangler d1 export subscription-manager --remote --output=backup-$(date +%F).sql
```

Restore a point in time with
`npx wrangler d1 time-travel restore subscription-manager --timestamp=<ISO>`.
