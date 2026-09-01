import { describe, expect, it } from "vitest";

import { buildDashboard } from "./dashboard";
import type { Currency, Pocket, Settings, Subscription } from "./types";

const currencies: Currency[] = [
  { code: "PLN", name: "zloty", symbol: "zł", rateToBase: 1, isBase: true },
  { code: "EUR", name: "Euro", symbol: "€", rateToBase: 4.3, isBase: false },
];

const settings: Settings = {
  baseCurrencyCode: "PLN",
  defaultRefillDay: 10,
  timezone: "Europe/Warsaw",
  monthlyIncomeMinor: 0,
  monthlyFoodMinor: 0,
};

const eurPocket: Pocket = { id: 1, name: "EUR", currencyCode: "EUR", refillDay: null };
const plnPocket: Pocket = { id: 2, name: "PLN", currencyCode: "PLN", refillDay: null };

function sub(o: Partial<Subscription> & Pick<Subscription, "id">): Subscription {
  return {
    name: `sub ${o.id}`,
    amountMinor: 1000,
    currencyCode: "EUR",
    pocketId: 1,
    intervalMonths: 1,
    firstBillingDate: "2026-01-01",
    billingDay: 1,
    endDate: null,
    active: true,
    notes: null,
    ...o,
  };
}

const A = sub({ id: 1, amountMinor: 1000, firstBillingDate: "2026-01-01", billingDay: 1 });
const B = sub({ id: 2, amountMinor: 2000, firstBillingDate: "2026-01-30", billingDay: 30 });
const C = sub({
  id: 3,
  amountMinor: 12000,
  intervalMonths: 12,
  firstBillingDate: "2025-09-15",
  billingDay: 15,
});
const D = sub({
  id: 4,
  pocketId: 2,
  currencyCode: "PLN",
  amountMinor: 3000,
  firstBillingDate: "2026-01-20",
  billingDay: 20,
});

describe("buildDashboard", () => {
  const board = buildDashboard(
    [eurPocket, plnPocket],
    [A, B, C, D],
    currencies,
    settings,
    "2026-08-15",
  );

  it("carries today and the base currency", () => {
    expect(board.todayISO).toBe("2026-08-15");
    expect(board.baseCurrencyCode).toBe("PLN");
  });

  it("computes each pocket's balance, next refill and converted total", () => {
    const [eur, pln] = board.pockets;
    expect(eur!.balance.expectedBalanceMinor).toBe(14000);
    expect(eur!.expectedBalanceBaseMinor).toBe(60200); // 140.00 EUR * 4.3
    expect(eur!.nextRefillDate).toBe("2026-09-10");
    expect(pln!.balance.expectedBalanceMinor).toBe(3000);
    expect(pln!.expectedBalanceBaseMinor).toBe(3000);
  });

  it("sums the grand total in the base currency", () => {
    expect(board.grandTotalBaseMinor).toBe(63200);
  });

  it("lists only the charges due up to the next refill, sorted", () => {
    // next refill is 2026-09-10, so B (30th, next = Aug 30) and A (1st, next = Sep 1)
    // are in; C (Sep 15) and the following month's B/A are not.
    const eur = board.pockets[0]!;
    expect(eur.upcoming.map((c) => c.date)).toEqual(["2026-08-30", "2026-09-01"]);
    expect(eur.upcoming.every((c) => !c.paid)).toBe(true);
  });

  it("threads marked-paid charges into the balance and the upcoming list", () => {
    const paid = new Map([[A.id, new Set(["2026-09-01"])]]);
    const b = buildDashboard([eurPocket], [A, B, C], currencies, settings, "2026-08-15", paid);
    const eur = b.pockets[0]!;
    expect(eur.upcoming.find((c) => c.subscription.id === A.id)?.paid).toBe(true);
    // A's imminent charge (Sep 1) is settled -> A contributes 0 -> pocket 130.00
    expect(eur.balance.lines.find((l) => l.subscription.id === A.id)?.contributionMinor).toBe(0);
    expect(eur.balance.expectedBalanceMinor).toBe(13000);
  });

  it("includes a charge that lands exactly on the refill day", () => {
    const onRefillDay = sub({
      id: 5,
      amountMinor: 500,
      firstBillingDate: "2026-02-10",
      billingDay: 10,
    });
    const board2 = buildDashboard(
      [eurPocket],
      [A, onRefillDay],
      currencies,
      settings,
      "2026-08-15",
    );
    expect(board2.pockets[0]!.upcoming.map((c) => c.date)).toEqual(["2026-09-01", "2026-09-10"]);
  });

  it("throws when a pocket references an unknown currency", () => {
    const orphan: Pocket = { id: 9, name: "GBP", currencyCode: "GBP", refillDay: null };
    expect(() => buildDashboard([orphan], [], currencies, settings, "2026-08-15")).toThrow(
      /Unknown currency/,
    );
  });
});
