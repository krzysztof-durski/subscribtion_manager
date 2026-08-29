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
 * See `docs/POCKET-MODEL.md` for the worked example this implements.
 */

import { addMonths, compareISODate, type ISODate } from "./dates";
import { monthlyEquivalentMinor } from "./money";
import { refillCount } from "./refill";
import { billingOccurrencesBetween, lastBillingOnOrBefore } from "./schedule";
import type { Pocket, Settings, Subscription } from "./types";

/** The refill day that applies to a pocket (its own, or the global default). */
export function effectiveRefillDay(pocket: Pocket, settings: Settings): number {
  return pocket.refillDay ?? settings.defaultRefillDay;
}

/**
 * How much of `sub`'s cost should currently be set aside in its pocket.
 *
 * The accumulation window starts at the subscription's most recent charge on or
 * before `todayISO`. If it has never charged, it starts one interval before the
 * first charge — i.e. the model assumes you have been saving toward that first
 * charge since a full cycle earlier.
 */
export function subscriptionContributionMinor(
  sub: Subscription,
  refillDay: number,
  todayISO: ISODate,
): number {
  if (!sub.active) return 0;

  const lastCharge = lastBillingOnOrBefore(sub, todayISO);
  const accumulationStart = lastCharge ?? addMonths(sub.firstBillingDate, -sub.intervalMonths);

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
): PocketBalance {
  const refillDay = effectiveRefillDay(pocket, settings);
  const pocketSubs = subs.filter((s) => s.pocketId === pocket.id && s.active);

  const lines: PocketBalanceLine[] = pocketSubs.map((subscription) => ({
    subscription,
    contributionMinor: subscriptionContributionMinor(subscription, refillDay, todayISO),
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
): UpcomingCharge[] {
  const charges: UpcomingCharge[] = [];
  for (const subscription of subs) {
    if (!subscription.active || subscription.pocketId !== pocket.id) continue;
    for (const date of billingOccurrencesBetween(subscription, todayISO, horizonISO)) {
      charges.push({ subscription, date, amountMinor: subscription.amountMinor });
    }
  }
  return charges.sort((a, b) => compareISODate(a.date, b.date));
}
