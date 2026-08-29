/**
 * Money helpers.
 *
 * All amounts are integer minor units (grosze, eurocents, …). Arithmetic stays
 * in integers; rounding happens once, explicitly, at each boundary. Never store
 * or accumulate a fractional minor unit.
 */

import { MINOR_UNITS_PER_MAJOR, type Currency } from "./types";

/** Look up a currency by code, throwing if the app is missing that row. */
export function currencyByCode(currencies: readonly Currency[], code: string): Currency {
  const found = currencies.find((c) => c.code === code);
  if (!found) throw new Error(`Unknown currency: ${code}`);
  return found;
}

/**
 * Convert `amountMinor`, expressed in `from`'s minor units, into the base
 * currency's minor units. Valid because every currency shares the same 2-d.p.
 * scale, so `minor * (baseUnits per unit)` is already base-minor.
 */
export function toBaseMinor(amountMinor: number, from: Currency): number {
  return Math.round(amountMinor * from.rateToBase);
}

/**
 * The share of `amountMinor` attributable to one month, given a billing interval
 * of `intervalMonths`. A 120.00 / year subscription yields 10.00 / month. Used
 * both for the sinking-fund pocket math and the savings breakdown.
 */
export function monthlyEquivalentMinor(amountMinor: number, intervalMonths: number): number {
  if (intervalMonths < 1) throw new Error(`intervalMonths must be >= 1: ${intervalMonths}`);
  return Math.round(amountMinor / intervalMonths);
}

/** Format minor units for display, e.g. `4295` + PLN -> `"42.95 PLN"`. */
export function formatMinor(amountMinor: number, currency: Currency): string {
  const major = amountMinor / MINOR_UNITS_PER_MAJOR;
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${number} ${currency.code}`;
}

/** {@link formatMinor} that looks the currency up by code. */
export function formatMinorByCode(
  amountMinor: number,
  code: string,
  currencies: readonly Currency[],
): string {
  return formatMinor(amountMinor, currencyByCode(currencies, code));
}

/**
 * Parse a user-entered, non-negative major-unit amount (e.g. `"9.99"` or
 * `"9,99"`) into minor units. Rejects negatives and more than two decimals.
 */
export function parseMajorToMinor(input: string): number {
  const trimmed = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Not a valid amount: ${input}`);
  }
  return Math.round(Number(trimmed) * MINOR_UNITS_PER_MAJOR);
}
