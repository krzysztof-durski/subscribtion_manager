/**
 * The sinking-fund pocket model.
 *
 * On every refill day you set aside each active subscription's monthly-equivalent
 * (a 120.00 / year subscription contributes 10.00 / month). The pot for a
 * subscription grows one monthly-equivalent per refill and is spent down to zero
 * when the charge lands. So the amount that *should* be in a pocket right now is,
 * per subscription:
 *
 *   min( monthlyEquivalent * (refills since its last charge), one full charge )
 *
 * summed over the pocket's subscriptions. For monthly subscriptions this reduces
 * to "about one charge's worth"; the model only diverges from just-in-time
 * funding for quarterly / yearly subscriptions.
 *
 * The "last charge" is the most recent occurrence *before today*, unless the
 * user has manually marked the imminent (today-or-later) occurrence as paid — in
 * which case that one counts as settled. See `docs/POCKET-MODEL.md`.
 */

import { addMonths, compareISODate, type ISODate } from "./dates";
import { monthlyEquivalentMinor } from "./money";
import { refillCount } from "./refill";
import { billingOccurrencesBetween, lastBillingBefore, nextBillingOnOrAfter } from "./schedule";
import type { Pocket, Settings, Subscription } from "./types";

/** For each subscription id, the scheduled charge dates the user marked settled. */
export type PaidCharges = ReadonlyMap<number, ReadonlySet<ISODate>>;

const NO_PAID_CHARGES: PaidCharges = new Map();

/** The refill day that applies to a pocket (its own, or the global default). */
export function effectiveRefillDay(pocket: Pocket, settings: Settings): number {
  return pocket.refillDay ?? settings.defaultRefillDay;
}

/**
 * How much of `sub`'s cost should currently be set aside in its pocket.
 *
 * The accumulation window starts at the subscription's most recent charge
 * *before* `todayISO` (a charge dated today is still upcoming, so its money
 * should still be in the pocket) — or, if the next charge on/after today has
 * been marked paid, at that charge. If it has never charged, the window starts
 * one interval before the first charge.
 */
export function subscriptionContributionMinor(
  sub: Subscription,
  refillDay: number,
  todayISO: ISODate,
  paidDates: ReadonlySet<ISODate> = new Set(),
): number {
  if (!sub.active) return 0;

  const naturalStart =
    lastBillingBefore(sub, todayISO) ?? addMonths(sub.firstBillingDate, -sub.intervalMonths);
  const imminent = nextBillingOnOrAfter(sub, todayISO);
  const accumulationStart = imminent && paidDates.has(imminent) ? imminent : naturalStart;

  const refills = refillCount(refillDay, accumulationStart, todayISO);
  const perMonth = monthlyEquivalentMinor(sub.amountMinor, sub.intervalMonths);
  return Math.min(refills * perMonth, sub.amountMinor);
}

export interface PocketBalanceLine {
  subscription: Subscription;
  contributionMinor: number;
}

export interface PocketBalance {
  pocket: Pocket;
  refillDay: number;
  /** What should be in the pocket right now, in its currency's minor units. */
  expectedBalanceMinor: number;
  /** Fixed amount to add on every refill day (sum of monthly-equivalents). */
  monthlyRefillMinor: number;
  lines: PocketBalanceLine[];
}

/** Expected balance and monthly refill for a single pocket. */
export function pocketBalance(
  pocket: Pocket,
  subs: readonly Subscription[],
  settings: Settings,
  todayISO: ISODate,
  paidCharges: PaidCharges = NO_PAID_CHARGES,
): PocketBalance {
  const refillDay = effectiveRefillDay(pocket, settings);
  const pocketSubs = subs.filter((s) => s.pocketId === pocket.id && s.active);

  const lines: PocketBalanceLine[] = pocketSubs.map((subscription) => ({
    subscription,
    contributionMinor: subscriptionContributionMinor(
      subscription,
      refillDay,
      todayISO,
      paidCharges.get(subscription.id),
    ),
  }));

  return {
    pocket,
    refillDay,
    expectedBalanceMinor: lines.reduce((sum, line) => sum + line.contributionMinor, 0),
    monthlyRefillMinor: pocketSubs.reduce(
      (sum, s) => sum + monthlyEquivalentMinor(s.amountMinor, s.intervalMonths),
      0,
    ),
    lines,
  };
}

export interface UpcomingCharge {
  subscription: Subscription;
  date: ISODate;
  amountMinor: number;
  /** True when the user has marked this scheduled charge as settled. */
  paid: boolean;
}

/**
 * Charges due for a pocket's active subscriptions in `[todayISO, horizonISO)`,
 * ascending by date. Feeds the dashboard's "what's coming up" list.
 */
export function upcomingCharges(
  pocket: Pocket,
  subs: readonly Subscription[],
  todayISO: ISODate,
  horizonISO: ISODate,
  paidCharges: PaidCharges = NO_PAID_CHARGES,
): UpcomingCharge[] {
  const charges: UpcomingCharge[] = [];
  for (const subscription of subs) {
    if (!subscription.active || subscription.pocketId !== pocket.id) continue;
    const paidDates = paidCharges.get(subscription.id);
    for (const date of billingOccurrencesBetween(subscription, todayISO, horizonISO)) {
      charges.push({
        subscription,
        date,
        amountMinor: subscription.amountMinor,
        paid: paidDates?.has(date) ?? false,
      });
    }
  }
  return charges.sort((a, b) => compareISODate(a.date, b.date));
}
