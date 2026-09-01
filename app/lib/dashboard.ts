/**
 * Assembles the dashboard view model: for each pocket, the expected balance now,
 * the fixed monthly refill, the next refill date, and the charges due between now
 * and that refill; plus a grand total converted to the base currency.
 *
 * Pure composition over `pockets.ts` / `refill.ts` / `money.ts` so the route
 * loader stays a thin "read rows -> build view model -> render".
 */

import { addDays, type ISODate } from "./dates";
import { toBaseMinor } from "./money";
import {
  effectiveRefillDay,
  pocketBalance,
  upcomingCharges,
  type PaidCharges,
  type PocketBalance,
  type UpcomingCharge,
} from "./pockets";
import { nextRefillAfter } from "./refill";
import type { Currency, Pocket, Settings, Subscription } from "./types";

export interface PocketDashboard {
  balance: PocketBalance;
  nextRefillDate: ISODate;
  /** Charges due from today up to and including the next refill date, sorted. */
  upcoming: UpcomingCharge[];
  /** `balance.expectedBalanceMinor` converted to base-currency minor units. */
  expectedBalanceBaseMinor: number;
}

export interface Dashboard {
  todayISO: ISODate;
  baseCurrencyCode: string;
  pockets: PocketDashboard[];
  /** Sum of every pocket's expected balance, in base-currency minor units. */
  grandTotalBaseMinor: number;
}

export function buildDashboard(
  pockets: readonly Pocket[],
  subscriptions: readonly Subscription[],
  currencies: readonly Currency[],
  settings: Settings,
  todayISO: ISODate,
  paidCharges: PaidCharges = new Map(),
): Dashboard {
  const currencyOf = (code: string) => {
    const found = currencies.find((c) => c.code === code);
    if (!found) throw new Error(`Unknown currency: ${code}`);
    return found;
  };

  const pocketViews: PocketDashboard[] = pockets.map((pocket) => {
    const balance = pocketBalance(pocket, subscriptions, settings, todayISO, paidCharges);
    const nextRefillDate = nextRefillAfter(effectiveRefillDay(pocket, settings), todayISO);
    return {
      balance,
      nextRefillDate,
      // Window: [today, nextRefill] — what will drain the pocket before you top it up.
      upcoming: upcomingCharges(
        pocket,
        subscriptions,
        todayISO,
        addDays(nextRefillDate, 1),
        paidCharges,
      ),
      expectedBalanceBaseMinor: toBaseMinor(
        balance.expectedBalanceMinor,
        currencyOf(pocket.currencyCode),
      ),
    };
  });

  return {
    todayISO,
    baseCurrencyCode: settings.baseCurrencyCode,
    pockets: pocketViews,
    grandTotalBaseMinor: pocketViews.reduce((sum, p) => sum + p.expectedBalanceBaseMinor, 0),
  };
}
