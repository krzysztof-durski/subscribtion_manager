-- Initial schema. Applied with `wrangler d1 migrations apply subscription-manager`.
-- Money columns are integer minor units; date columns are `YYYY-MM-DD` text.

CREATE TABLE currencies (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  symbol       TEXT,
  rate_to_base REAL NOT NULL DEFAULT 1,
  is_base      INTEGER NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE pockets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  currency_code TEXT NOT NULL REFERENCES currencies(code),
  refill_day    INTEGER,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_pockets_currency ON pockets(currency_code);

CREATE TABLE subscriptions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  amount_minor       INTEGER NOT NULL,
  currency_code      TEXT NOT NULL REFERENCES currencies(code),
  pocket_id          INTEGER NOT NULL REFERENCES pockets(id),
  interval_months    INTEGER NOT NULL,
  first_billing_date TEXT NOT NULL,
  billing_day        INTEGER NOT NULL,
  end_date           TEXT,
  active             INTEGER NOT NULL DEFAULT 1,
  notes              TEXT,
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_subscriptions_pocket ON subscriptions(pocket_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(active);

CREATE TABLE settings (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  base_currency_code   TEXT NOT NULL DEFAULT 'PLN' REFERENCES currencies(code),
  default_refill_day   INTEGER NOT NULL DEFAULT 11,
  timezone             TEXT NOT NULL DEFAULT 'Europe/Warsaw',
  monthly_income_minor INTEGER NOT NULL DEFAULT 0,
  monthly_food_minor   INTEGER NOT NULL DEFAULT 0
);
