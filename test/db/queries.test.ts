import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { getDb } from "~/db/client";
import {
  createPocket,
  createSubscription,
  deleteSubscription,
  getAppData,
  getCurrencies,
  getPockets,
  getSettings,
  getSubscriptions,
  updateSettings,
  upsertCurrency,
} from "~/db/queries";
import { pocketBalance } from "~/lib/pockets";

const db = getDb(env.DB);

/** Reset user data between tests; the seed rows from migrations stay. */
beforeEach(async () => {
  await env.DB.exec("DELETE FROM subscriptions");
  await env.DB.exec("DELETE FROM pockets");
  await env.DB.exec(
    "UPDATE settings SET monthly_income_minor = 0, monthly_food_minor = 0, default_refill_day = 11",
  );
});

describe("migrations + seed", () => {
  it("seeds the three starting currencies and the settings row", async () => {
    const currencies = await getCurrencies(db);
    expect(currencies.map((c) => c.code)).toEqual(["PLN", "EUR", "USD"]);
    expect(currencies.find((c) => c.code === "PLN")?.isBase).toBe(true);

    const settings = await getSettings(db);
    expect(settings.baseCurrencyCode).toBe("PLN");
    expect(settings.timezone).toBe("Europe/Warsaw");
  });
});

describe("pocket + subscription round-trips", () => {
  it("maps rows onto domain types, including booleans and nulls", async () => {
    await createPocket(db, { name: "EUR", currencyCode: "EUR", refillDay: null });
    const [pocket] = await getPockets(db);
    expect(pocket).toMatchObject({ name: "EUR", currencyCode: "EUR", refillDay: null });

    await createSubscription(db, {
      name: "Spotify",
      amountMinor: 1199,
      currencyCode: "EUR",
      pocketId: pocket!.id,
      intervalMonths: 1,
      firstBillingDate: "2026-01-05",
      billingDay: 5,
      endDate: null,
      active: true,
      notes: null,
    });

    const [sub] = await getSubscriptions(db);
    expect(sub).toMatchObject({
      name: "Spotify",
      amountMinor: 1199,
      pocketId: pocket!.id,
      active: true,
      endDate: null,
    });

    await deleteSubscription(db, sub!.id);
    expect(await getSubscriptions(db)).toHaveLength(0);
  });
});

describe("settings + currency writes", () => {
  it("updates settings and currency rates", async () => {
    await updateSettings(db, {
      defaultRefillDay: 10,
      timezone: "Europe/Warsaw",
      monthlyIncomeMinor: 1_200_000,
      monthlyFoodMinor: 140_000,
    });
    await upsertCurrency(db, { code: "EUR", name: "Euro", symbol: "€", rateToBase: 4.5 });
    await upsertCurrency(db, { code: "GBP", name: "Pound", symbol: "£", rateToBase: 5.2 });

    const settings = await getSettings(db);
    expect(settings.monthlyIncomeMinor).toBe(1_200_000);
    expect(settings.defaultRefillDay).toBe(10);

    const currencies = await getCurrencies(db);
    expect(currencies.find((c) => c.code === "EUR")?.rateToBase).toBe(4.5);
    expect(currencies.find((c) => c.code === "GBP")?.rateToBase).toBe(5.2);
  });
});

describe("end-to-end dashboard computation", () => {
  it("reproduces the canonical 140.00 EUR balance through the real schema", async () => {
    await updateSettings(db, {
      defaultRefillDay: 10,
      timezone: "Europe/Warsaw",
      monthlyIncomeMinor: 0,
      monthlyFoodMinor: 0,
    });
    await createPocket(db, { name: "EUR", currencyCode: "EUR", refillDay: null });
    const [pocket] = await getPockets(db);
    const pocketId = pocket!.id;

    const base = {
      currencyCode: "EUR",
      pocketId,
      endDate: null,
      active: true,
      notes: null,
    };
    await createSubscription(db, {
      ...base,
      name: "A",
      amountMinor: 1000,
      intervalMonths: 1,
      firstBillingDate: "2026-01-01",
      billingDay: 1,
    });
    await createSubscription(db, {
      ...base,
      name: "B",
      amountMinor: 2000,
      intervalMonths: 1,
      firstBillingDate: "2026-01-30",
      billingDay: 30,
    });
    await createSubscription(db, {
      ...base,
      name: "C",
      amountMinor: 12000,
      intervalMonths: 12,
      firstBillingDate: "2025-09-15",
      billingDay: 15,
    });

    const data = await getAppData(db);
    const balance = pocketBalance(
      data.pockets[0]!,
      data.subscriptions,
      data.settings,
      "2026-08-15",
    );
    expect(balance.expectedBalanceMinor).toBe(14000);
    expect(balance.monthlyRefillMinor).toBe(4000);
  });
});
