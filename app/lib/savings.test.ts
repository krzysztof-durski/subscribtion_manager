import { describe, expect, it } from "vitest";

import { monthlySavings } from "./savings";
import type { Currency, Settings, Subscription } from "./types";

const currencies: Currency[] = [
  { code: "PLN", name: "Polish zloty", symbol: "zł", rateToBase: 1, isBase: true },
  { code: "EUR", name: "Euro", symbol: "€", rateToBase: 4.3, isBase: false },
  { code: "USD", name: "US dollar", symbol: "$", rateToBase: 4.0, isBase: false },
];

const settings: Settings = {
  baseCurrencyCode: "PLN",
  defaultRefillDay: 11,
  timezone: "Europe/Warsaw",
  monthlyIncomeMinor: 1_200_000, // 12 000.00 PLN
  monthlyFoodMinor: 140_000, // 1 400.00 PLN
};

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 1,
    name: "sub",
    amountMinor: 1000,
    currencyCode: "EUR",
    pocketId: 1,
    intervalMonths: 1,
    firstBillingDate: "2026-01-01",
    billingDay: 1,
    endDate: null,
    active: true,
    notes: null,
    ...overrides,
  };
}

describe("monthlySavings", () => {
  it("computes income - subscriptions(PLN) - food (plan verification case)", () => {
    const result = monthlySavings(
      settings,
      [sub({ amountMinor: 1000, intervalMonths: 1 })],
      currencies,
    );
    expect(result.subscriptionsBaseMinor).toBe(4300); // 10.00 EUR -> 43.00 PLN
    expect(result.savingsMinor).toBe(1_055_700); // 12 000 - 43 - 1 400 = 10 557.00 PLN
  });

  it("normalises each interval to a monthly-equivalent before converting", () => {
    const result = monthlySavings(
      settings,
      [
        sub({ id: 1, name: "monthly", currencyCode: "PLN", amountMinor: 5000, intervalMonths: 1 }),
        sub({ id: 2, name: "yearly", currencyCode: "USD", amountMinor: 12000, intervalMonths: 12 }),
      ],
      currencies,
    );
    // monthly: 50.00 PLN; yearly: 10.00 USD/mo -> 40.00 PLN
    expect(result.subscriptionsBaseMinor).toBe(5000 + 4000);
    expect(result.perCurrency).toEqual([
      { currencyCode: "PLN", monthlyMinor: 5000, monthlyBaseMinor: 5000 },
      { currencyCode: "USD", monthlyMinor: 1000, monthlyBaseMinor: 4000 },
    ]);
  });

  it("excludes paused subscriptions and can report negative savings", () => {
    const result = monthlySavings(
      { ...settings, monthlyIncomeMinor: 10_000 },
      [
        sub({ id: 1, currencyCode: "PLN", amountMinor: 900_000, intervalMonths: 1 }),
        sub({ id: 2, currencyCode: "PLN", amountMinor: 500_000, intervalMonths: 1, active: false }),
      ],
      currencies,
    );
    expect(result.lines).toHaveLength(1);
    expect(result.savingsMinor).toBe(10_000 - 900_000 - 140_000);
  });
});
