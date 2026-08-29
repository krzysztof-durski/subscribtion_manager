/**
 * Subscription billing schedules.
 *
 * A subscription charges on a fixed day of the month, every `intervalMonths`
 * months, phased to the month/year of its `firstBillingDate` anchor. The billing
 * day is clamped to each month's length, so a "31st" subscription charges on the
 * 28th/29th in February and the 30th in April.
 *
 * All ranges are half-open: `[from, to)`. `endDate`, when set, is an exclusive
 * upper bound — nothing is billed on or after it.
 */

import {
  addDays,
  addMonths,
  compareISODate,
  daysInMonth,
  formatISODate,
  maxISODate,
  minISODate,
  monthsBetween,
  parseISODate,
  type ISODate,
} from "./dates";
import type { Subscription } from "./types";

/** The charge date `step` intervals away from the anchor (step 0 == anchor month). */
function occurrenceAtStep(sub: Subscription, step: number): ISODate {
  const anchor = parseISODate(sub.firstBillingDate);
  const zeroBasedMonth = anchor.year * 12 + (anchor.month - 1) + step * sub.intervalMonths;
  const year = Math.floor(zeroBasedMonth / 12);
  const month = (((zeroBasedMonth % 12) + 12) % 12) + 1;
  return formatISODate({
    year,
    month,
    day: Math.min(sub.billingDay, daysInMonth(year, month)),
  });
}

/**
 * Every charge date for `sub` within `[fromISO, toISO)`, in ascending order.
 * Respects the anchor (no charges before `firstBillingDate`) and `endDate`.
 */
export function billingOccurrencesBetween(
  sub: Subscription,
  fromISO: ISODate,
  toISO: ISODate,
): ISODate[] {
  if (sub.intervalMonths < 1) throw new Error(`intervalMonths must be >= 1: ${sub.intervalMonths}`);

  const lower = maxISODate(fromISO, sub.firstBillingDate);
  const upperExclusive = sub.endDate ? minISODate(toISO, sub.endDate) : toISO;
  if (compareISODate(lower, upperExclusive) >= 0) return [];

  // Jump close to `lower` using month arithmetic, backing off one interval so a
  // boundary occurrence shifted by day-clamping is never skipped.
  const monthsFromAnchor = monthsBetween(sub.firstBillingDate, lower);
  let step = Math.max(0, Math.floor(monthsFromAnchor / sub.intervalMonths) - 1);

  const out: ISODate[] = [];
  for (let guard = 0; guard < 100_000; guard += 1, step += 1) {
    const occ = occurrenceAtStep(sub, step);
    if (compareISODate(occ, upperExclusive) >= 0) break;
    if (compareISODate(occ, lower) >= 0) out.push(occ);
  }
  return out;
}

/**
 * The most recent charge date on or before `dateISO`, or `null` if the
 * subscription has not had its first charge yet.
 */
export function lastBillingOnOrBefore(sub: Subscription, dateISO: ISODate): ISODate | null {
  if (compareISODate(dateISO, sub.firstBillingDate) < 0) return null;
  const searchFrom = maxISODate(
    sub.firstBillingDate,
    addMonths(dateISO, -(sub.intervalMonths + 1)),
  );
  const list = billingOccurrencesBetween(sub, searchFrom, addDays(dateISO, 1));
  return list.at(-1) ?? null;
}

/** The next charge date strictly after `dateISO`, or `null` if none remain. */
export function nextBillingAfter(sub: Subscription, dateISO: ISODate): ISODate | null {
  const horizonBase = maxISODate(dateISO, sub.firstBillingDate);
  const list = billingOccurrencesBetween(
    sub,
    addDays(dateISO, 1),
    addMonths(horizonBase, sub.intervalMonths + 2),
  );
  return list[0] ?? null;
}
