/**
 * Monthly savings: `income - subscriptions - food`, all in the base currency.
 *
 * Each subscription contributes its monthly-equivalent (yearly / 12, quarterly /
 * 3, …) converted to the base currency at the current manual rate. Income and
 * food come straight from settings and are already in the base currency.
 */

import { currencyByCode, monthlyEquivalentMinor, toBaseMinor } from "./money";
import type { Currency, Settings, Subscription } from "./types";

export interface SavingsLine {
  subscription: Subscription;
  /** Monthly-equivalent in the subscription's own currency, minor units. */
  monthlyMinor: number;
  /** The same amount converted to base-currency minor units. */
  monthlyBaseMinor: number;
}

export interface CurrencySubtotal {
  currencyCode: string;
  monthlyMinor: number;
  monthlyBaseMinor: number;
}

export interface SavingsSummary {
  incomeMinor: number;
  foodMinor: number;
  /** Total monthly subscription cost, base-currency minor units. */
  subscriptionsBaseMinor: number;
  /** `income - subscriptions - food`; negative means overspending. */
  savingsMinor: number;
  perCurrency: CurrencySubtotal[];
  lines: SavingsLine[];
}

/** Compute the savings summary from settings, active subscriptions and rates. */
export function monthlySavings(
  settings: Settings,
  subs: readonly Subscription[],
  currencies: readonly Currency[],
): SavingsSummary {
  const lines: SavingsLine[] = subs
    .filter((s) => s.active)
    .map((subscription) => {
      const monthlyMinor = monthlyEquivalentMinor(
        subscription.amountMinor,
        subscription.intervalMonths,
      );
      const currency = currencyByCode(currencies, subscription.currencyCode);
      return {
        subscription,
        monthlyMinor,
        monthlyBaseMinor: toBaseMinor(monthlyMinor, currency),
      };
    });

  const subscriptionsBaseMinor = lines.reduce((sum, line) => sum + line.monthlyBaseMinor, 0);

  const byCurrency = new Map<string, CurrencySubtotal>();
  for (const line of lines) {
    const code = line.subscription.currencyCode;
    const subtotal = byCurrency.get(code) ?? {
      currencyCode: code,
      monthlyMinor: 0,
      monthlyBaseMinor: 0,
    };
    subtotal.monthlyMinor += line.monthlyMinor;
    subtotal.monthlyBaseMinor += line.monthlyBaseMinor;
    byCurrency.set(code, subtotal);
  }

  return {
    incomeMinor: settings.monthlyIncomeMinor,
    foodMinor: settings.monthlyFoodMinor,
    subscriptionsBaseMinor,
    savingsMinor: settings.monthlyIncomeMinor - subscriptionsBaseMinor - settings.monthlyFoodMinor,
    perCurrency: [...byCurrency.values()].sort((a, b) => b.monthlyBaseMinor - a.monthlyBaseMinor),
    lines,
  };
}
