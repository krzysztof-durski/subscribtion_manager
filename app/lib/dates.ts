/**
 * Date-only helpers.
 *
 * Every schedule calculation in this app works on calendar dates with no time
 * and no timezone, represented as `YYYY-MM-DD` strings. Those strings sort
 * lexicographically in chronological order, so plain string comparison is the
 * ordering. "Today" is the only value that depends on a timezone, and it is
 * resolved once (via {@link todayISOInTimeZone}) at the edge of the system.
 *
 * Because the math never touches clock time, there are no DST or offset bugs to
 * reason about — only month lengths, which {@link daysInMonth} handles.
 */

/** A calendar date with no time component, formatted `YYYY-MM-DD`. */
export type ISODate = string;

/** Year / month / day triple. `month` is 1-12, `day` is 1-31. */
export interface DateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is a well-formed, real calendar date in `YYYY-MM-DD` form. */
export function isValidISODate(value: string): value is ISODate {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

/** Split an `ISODate` into its numeric parts. Throws on malformed input. */
export function parseISODate(iso: ISODate): DateParts {
  const match = ISO_DATE_RE.exec(iso);
  if (!match) throw new Error(`Not an ISO date (YYYY-MM-DD): ${iso}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Render numeric parts back to an `ISODate`, zero-padding month and day. */
export function formatISODate({ year, month, day }: DateParts): ISODate {
  const yyyy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Number of days in a given month. `month` is 1-12. */
export function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const length = lengths[month - 1];
  if (length === undefined) throw new Error(`Month out of range: ${month}`);
  return length;
}

/**
 * Add `count` calendar months to `iso` (negative counts subtract). The
 * day-of-month is clamped to the length of the target month, so
 * `addMonths("2026-01-31", 1)` is `"2026-02-28"`.
 */
export function addMonths(iso: ISODate, count: number): ISODate {
  const { year, month, day } = parseISODate(iso);
  const zeroBased = year * 12 + (month - 1) + count;
  const targetYear = Math.floor(zeroBased / 12);
  const targetMonth = (((zeroBased % 12) + 12) % 12) + 1;
  return formatISODate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth)),
  });
}

/**
 * Add `count` days to `iso` (negative counts subtract). Computed in UTC, so
 * month and year roll over correctly with no DST involvement.
 */
export function addDays(iso: ISODate, count: number): ISODate {
  const { year, month, day } = parseISODate(iso);
  const shifted = new Date(Date.UTC(year, month - 1, day + count));
  return formatISODate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** `-1` if `a` is earlier than `b`, `1` if later, `0` if the same day. */
export function compareISODate(a: ISODate, b: ISODate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The earlier of two dates. */
export function minISODate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b;
}

/** The later of two dates. */
export function maxISODate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b;
}

/** The whole number of calendar months from `from` to `to` (sign follows direction). */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/**
 * The current date in `timeZone` (an IANA name like `"Europe/Warsaw"`), taken
 * from `now`. This is the single point where wall-clock time enters the app.
 */
export function todayISOInTimeZone(timeZone: string, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value: Record<string, string> = {};
  for (const part of parts) value[part.type] = part.value;
  return `${value.year}-${value.month}-${value.day}`;
}
