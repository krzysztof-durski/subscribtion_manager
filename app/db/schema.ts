/**
 * Drizzle schema for the D1 database.
 *
 * This is the source of truth for *typed queries*. The source of truth for the
 * database *shape* is the hand-authored SQL under `drizzle/migrations/` — keep
 * the two in sync when either changes (see `docs/ARCHITECTURE.md`).
 *
 * Money columns are integer minor units. Dates are `YYYY-MM-DD` text.
 */

import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const currencies = sqliteTable("currencies", {
  /** ISO-4217-style code, e.g. `PLN`. */
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol"),
  /** Units of the base currency per 1 unit of this one. Base currency row = 1. */
  rateToBase: real("rate_to_base").notNull().default(1),
  isBase: integer("is_base", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const pockets = sqliteTable(
  "pockets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
    /** 1-31; null means "use settings.default_refill_day". */
    refillDay: integer("refill_day"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("idx_pockets_currency").on(t.currencyCode)],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** Price per billing cycle, in the currency's minor units. */
    amountMinor: integer("amount_minor").notNull(),
    currencyCode: text("currency_code")
      .notNull()
      .references(() => currencies.code),
    pocketId: integer("pocket_id")
      .notNull()
      .references(() => pockets.id),
    /** Months between charges: 1 monthly, 3 quarterly, 12 yearly. */
    intervalMonths: integer("interval_months").notNull(),
    /** Anchor charge date `YYYY-MM-DD`: sets phase + earliest charge. */
    firstBillingDate: text("first_billing_date").notNull(),
    /** Day of month a charge lands. Always the day-of-month of `firstBillingDate`
     * (kept as a column for query convenience); clamped to month length in code. */
    billingDay: integer("billing_day").notNull(),
    endDate: text("end_date"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_subscriptions_pocket").on(t.pocketId),
    index("idx_subscriptions_active").on(t.active),
  ],
);

/** Single-row table (id is always 1). */
export const settings = sqliteTable(
  "settings",
  {
    id: integer("id").primaryKey(),
    baseCurrencyCode: text("base_currency_code")
      .notNull()
      .default("PLN")
      .references(() => currencies.code),
    defaultRefillDay: integer("default_refill_day").notNull().default(11),
    timezone: text("timezone").notNull().default("Europe/Warsaw"),
    /** Typical monthly income, base-currency minor units. */
    monthlyIncomeMinor: integer("monthly_income_minor").notNull().default(0),
    /** Typical monthly food spending, base-currency minor units. */
    monthlyFoodMinor: integer("monthly_food_minor").notNull().default(0),
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`)],
);
