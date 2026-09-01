import { describe, expect, it } from "vitest";

import {
  effectiveRefillDay,
  pocketBalance,
  subscriptionContributionMinor,
  upcomingCharges,
} from "./pockets";
import type { Pocket, Settings, Subscription } from "./types";

const settings: Settings = {
  baseCurrencyCode: "PLN",
  defaultRefillDay: 10,
  timezone: "Europe/Warsaw",
  monthlyIncomeMinor: 0,
  monthlyFoodMinor: 0,
};

const eurPocket: Pocket = {
  id: 1,
  name: "EUR subscriptions",
  currencyCode: "EUR",
  refillDay: null,
};

/**
 * The scenario from the plan Q&A. Refill day is the 10th; one EUR pocket:
 *   A  10.00 EUR / month, billed on the 1st
 *   B  20.00 EUR / month, billed on the 30th
 *   C 120.00 EUR / year,  billed on 15 September
 */
const A: Subscription = {
  id: 1,
  name: "A",
  amountMinor: 1000,
  currencyCode: "EUR",
  pocketId: 1,
  intervalMonths: 1,
  firstBillingDate: "2026-01-01",
  billingDay: 1,
  endDate: null,
  active: true,
  notes: null,
};
const B: Subscription = {
  id: 2,
  name: "B",
  amountMinor: 2000,
  currencyCode: "EUR",
  pocketId: 1,
  intervalMonths: 1,
  firstBillingDate: "2026-01-30",
  billingDay: 30,
  endDate: null,
  active: true,
  notes: null,
};
const C: Subscription = {
  id: 3,
  name: "C",
  amountMinor: 12000,
  currencyCode: "EUR",
  pocketId: 1,
  intervalMonths: 12,
  firstBillingDate: "2025-09-15",
  billingDay: 15,
  endDate: null,
  active: true,
  notes: null,
};

describe("effectiveRefillDay", () => {
  it("prefers the pocket's own day, falling back to the default", () => {
    expect(effectiveRefillDay(eurPocket, settings)).toBe(10);
    expect(effectiveRefillDay({ ...eurPocket, refillDay: 5 }, settings)).toBe(5);
  });
});

describe("subscriptionContributionMinor", () => {
  it("contributes nothing for a paused subscription", () => {
    expect(subscriptionContributionMinor({ ...A, active: false }, 10, "2026-08-15")).toBe(0);
  });

  it("holds ~one charge for a monthly subscription", () => {
    expect(subscriptionContributionMinor(A, 10, "2026-08-15")).toBe(1000);
    expect(subscriptionContributionMinor(B, 10, "2026-08-15")).toBe(2000);
  });

  it("accrues a yearly charge one refill at a time and caps at the full amount", () => {
    expect(subscriptionContributionMinor(C, 10, "2026-08-15")).toBe(11000); // 11 refills x 10.00
    expect(subscriptionContributionMinor(C, 10, "2026-09-10")).toBe(12000); // 12th refill -> full
    expect(subscriptionContributionMinor(C, 10, "2026-09-15")).toBe(12000); // charge day: still held
    expect(subscriptionContributionMinor(C, 10, "2026-09-16")).toBe(0); // day after: pot reset
  });

  it("still holds the money on the charge day itself (charge treated as upcoming)", () => {
    expect(subscriptionContributionMinor(A, 10, "2026-09-01")).toBe(1000); // A bills on the 1st
    expect(subscriptionContributionMinor(A, 10, "2026-09-02")).toBe(0); // spent the day after
  });

  it("assumes saving started a full cycle before a not-yet-charged subscription", () => {
    const future: Subscription = { ...C, id: 9, firstBillingDate: "2026-12-15" };
    // accumulation from 2025-12-15; 8 refills (Jan–Aug 2026) by 15 Aug.
    expect(subscriptionContributionMinor(future, 10, "2026-08-15")).toBe(8000);
  });

  it("drops to zero when the imminent charge is marked paid", () => {
    // A bills on the 1st; on 1 Sep it would normally still be held (€10.00)…
    expect(subscriptionContributionMinor(A, 10, "2026-09-01")).toBe(1000);
    // …unless that occurrence is marked settled.
    expect(subscriptionContributionMinor(A, 10, "2026-09-01", new Set(["2026-09-01"]))).toBe(0);
    // works ahead of the date too (charge cleared early)
    expect(subscriptionContributionMinor(A, 10, "2026-08-31", new Set(["2026-09-01"]))).toBe(0);
  });

  it("ignores a paid mark that is not the imminent occurrence", () => {
    expect(subscriptionContributionMinor(A, 10, "2026-09-01", new Set(["2026-07-01"]))).toBe(1000);
  });
});

describe("pocketBalance — canonical scenario", () => {
  it("expects 140.00 EUR on 15 August with a 40.00 EUR monthly refill", () => {
    const result = pocketBalance(eurPocket, [A, B, C], settings, "2026-08-15");
    expect(result.expectedBalanceMinor).toBe(14000);
    expect(result.monthlyRefillMinor).toBe(4000);
    expect(result.refillDay).toBe(10);
    expect(result.lines.map((l) => [l.subscription.name, l.contributionMinor])).toEqual([
      ["A", 1000],
      ["B", 2000],
      ["C", 11000],
    ]);
  });

  it("expects 150.00 EUR just after the pre-renewal refill", () => {
    expect(pocketBalance(eurPocket, [A, B, C], settings, "2026-09-10").expectedBalanceMinor).toBe(
      15000,
    );
  });

  it("drops to 30.00 EUR the day after the annual charge", () => {
    expect(pocketBalance(eurPocket, [A, B, C], settings, "2026-09-16").expectedBalanceMinor).toBe(
      3000,
    );
  });

  it("ignores paused subscriptions and other pockets", () => {
    const paused: Subscription = { ...A, id: 4, name: "paused", active: false };
    const otherPocket: Subscription = { ...A, id: 5, name: "other", pocketId: 2 };
    const result = pocketBalance(eurPocket, [A, B, C, paused, otherPocket], settings, "2026-08-15");
    expect(result.expectedBalanceMinor).toBe(14000);
    expect(result.lines).toHaveLength(3);
  });

  it("subtracts a subscription whose imminent charge is marked paid", () => {
    // 15 Sep, C's renewal day: normally C holds 120.00 -> pocket 150.00.
    const paid = new Map([[C.id, new Set(["2026-09-15"])]]);
    const result = pocketBalance(eurPocket, [A, B, C], settings, "2026-09-15", paid);
    expect(result.lines.find((l) => l.subscription.id === C.id)?.contributionMinor).toBe(0);
    expect(result.expectedBalanceMinor).toBe(3000); // A 10 + B 20 + C 0
  });
});

describe("upcomingCharges", () => {
  it("lists a pocket's charges within the horizon, sorted by date", () => {
    const charges = upcomingCharges(eurPocket, [A, B, C], "2026-08-15", "2026-10-01");
    expect(charges.map((c) => [c.date, c.subscription.name, c.amountMinor])).toEqual([
      ["2026-08-30", "B", 2000],
      ["2026-09-01", "A", 1000],
      ["2026-09-15", "C", 12000],
      ["2026-09-30", "B", 2000],
    ]);
  });

  it("treats the horizon as exclusive and skips inactive / foreign subscriptions", () => {
    const paused: Subscription = { ...C, id: 7, active: false };
    const foreign: Subscription = { ...A, id: 8, pocketId: 2 };
    const charges = upcomingCharges(
      eurPocket,
      [A, B, C, paused, foreign],
      "2026-08-15",
      "2026-09-01",
    );
    expect(charges.map((c) => c.date)).toEqual(["2026-08-30"]);
  });

  it("flags each charge with its paid status", () => {
    const paid = new Map([[A.id, new Set(["2026-09-01"])]]);
    const charges = upcomingCharges(eurPocket, [A, B], "2026-08-15", "2026-10-01", paid);
    expect(charges.map((c) => [c.subscription.name, c.date, c.paid])).toEqual([
      ["B", "2026-08-30", false],
      ["A", "2026-09-01", true],
      ["B", "2026-09-30", false],
    ]);
  });
});
