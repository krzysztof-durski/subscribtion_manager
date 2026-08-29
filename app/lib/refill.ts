/**
 * Pocket refill dates.
 *
 * A pocket is topped up once a month on its refill day (clamped to month
 * length). These helpers enumerate and count those dates; the sinking-fund
 * balance in `pockets.ts` is driven entirely by *how many* refills have happened
 * since a subscription's last charge.
 */

import {
  addDays,
  addMonths,
  compareISODate,
  daysInMonth,
  formatISODate,
  parseISODate,
  type ISODate,
} from "./dates";

function assertRefillDay(refillDay: number): void {
  if (!Number.isInteger(refillDay) || refillDay < 1 || refillDay > 31) {
    throw new Error(`refillDay must be an integer 1-31: ${refillDay}`);
  }
}

/** Every refill date in `[fromISO, toISO)`, ascending. */
export function refillDatesBetween(refillDay: number, fromISO: ISODate, toISO: ISODate): ISODate[] {
  assertRefillDay(refillDay);
  if (compareISODate(fromISO, toISO) >= 0) return [];

  const start = parseISODate(fromISO);
  // Begin one month before `from` so a day-clamped refill at the boundary is
  // considered, then walk forward month by month.
  let cursor = addMonths(formatISODate({ year: start.year, month: start.month, day: 1 }), -1);

  const out: ISODate[] = [];
  for (let guard = 0; guard < 100_000; guard += 1) {
    const { year, month } = parseISODate(cursor);
    const date = formatISODate({
      year,
      month,
      day: Math.min(refillDay, daysInMonth(year, month)),
    });
    if (compareISODate(date, toISO) >= 0) break;
    if (compareISODate(date, fromISO) >= 0) out.push(date);
    cursor = addMonths(cursor, 1);
  }
  return out;
}

/** Number of refill dates `d` with `afterISO < d <= throughISO`. */
export function refillCount(refillDay: number, afterISO: ISODate, throughISO: ISODate): number {
  if (compareISODate(afterISO, throughISO) >= 0) return 0;
  return refillDatesBetween(refillDay, addDays(afterISO, 1), addDays(throughISO, 1)).length;
}

/** The most recent refill date on or before `dateISO`. */
export function lastRefillOnOrBefore(refillDay: number, dateISO: ISODate): ISODate {
  const list = refillDatesBetween(refillDay, addMonths(dateISO, -2), addDays(dateISO, 1));
  const last = list.at(-1);
  /* v8 ignore next -- a refill lands at least once a month, so the window is never empty */
  if (!last) throw new Error("unreachable: no refill in a two-month window");
  return last;
}

/** The next refill date strictly after `dateISO`. */
export function nextRefillAfter(refillDay: number, dateISO: ISODate): ISODate {
  const list = refillDatesBetween(refillDay, addDays(dateISO, 1), addMonths(dateISO, 2));
  const first = list[0];
  /* v8 ignore next -- a refill lands at least once a month, so the window is never empty */
  if (!first) throw new Error("unreachable: no refill in a two-month window");
  return first;
}
