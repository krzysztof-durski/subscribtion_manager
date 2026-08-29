/**
 * Plain domain types.
 *
 * These describe the data the calculations in `app/lib` operate on. They are
 * deliberately decoupled from the database schema (`app/db/schema.ts`) and from
 * React Router — the DB layer maps rows onto these shapes, and every function in
 * `app/lib` takes and returns plain values built from them.
 */

import type { ISODate } from "./dates";

/** Minor currency units per major unit. Every currency in this app uses 2 d.p. */
export const MINOR_UNITS_PER_MAJOR = 100;

export interface Currency {
  /** ISO-4217-style code used as the primary key, e.g. `"PLN"`, `"EUR"`. */
  code: string;
  name: string;
  /** Optional display symbol, e.g. `"€"`. */
  symbol: string | null;
  /**
   * Units of the base currency per 1 unit of this currency (e.g. PLN per EUR).
   * The base currency's own rate is `1`.
   */
  rateToBase: number;
  isBase: boolean;
}

export interface Pocket {
  id: number;
  name: string;
  /** Currency held in this pocket; every subscription in it shares this code. */
  currencyCode: string;
  /**
   * Day of the month (1-31) this pocket is topped up. `null` means "use
   * {@link Settings.defaultRefillDay}". Clamped to month length when applied.
   */
  refillDay: number | null;
}

export interface Subscription {
  id: number;
  name: string;
  /** Price charged each billing cycle, in {@link Currency} minor units. */
  amountMinor: number;
  currencyCode: string;
  pocketId: number;
  /** Months between charges: `1` monthly, `3` quarterly, `12` yearly, etc. */
  intervalMonths: number;
  /**
   * Anchor date: a genuine charge date. Its day-of-month is the billing day and
   * its month/year fix the phase for multi-month intervals. Also the earliest
   * date a charge can occur — nothing is billed before it.
   */
  firstBillingDate: ISODate;
  /** Day of the month a charge lands (1-31), clamped to month length. */
  billingDay: number;
  /** If set, no charge occurs on or after this date. */
  endDate: ISODate | null;
  /** Paused subscriptions contribute nothing and generate no charges. */
  active: boolean;
  /** Free-text note; not used by any calculation. */
  notes: string | null;
}

export interface Settings {
  baseCurrencyCode: string;
  /** Fallback refill day for pockets that do not set their own. */
  defaultRefillDay: number;
  /** IANA timezone used to resolve "today", e.g. `"Europe/Warsaw"`. */
  timezone: string;
  /** Typical monthly income, in base-currency minor units. */
  monthlyIncomeMinor: number;
  /** Typical monthly food spending, in base-currency minor units. */
  monthlyFoodMinor: number;
}
