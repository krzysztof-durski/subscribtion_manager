-- Manual "this charge is settled" overrides. One row per (subscription, scheduled
-- charge date) that the user has marked paid — used to zero that subscription's
-- set-aside amount even if the calendar says the charge is still upcoming (e.g.
-- it cleared early, or the billing date shifted).

CREATE TABLE charge_payments (
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  due_date        TEXT NOT NULL,
  paid_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subscription_id, due_date)
);
