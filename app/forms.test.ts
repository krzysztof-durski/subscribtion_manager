import { describe, expect, it } from "vitest";

import {
  parseCurrencyForm,
  parseFinancesForm,
  parsePocketForm,
  parseSettingsForm,
  parseSubscriptionForm,
} from "./forms";
import type { Pocket } from "./lib/types";

function fd(entries: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(entries)) form.append(k, v);
  return form;
}

const pockets: Pocket[] = [
  { id: 1, name: "EUR", currencyCode: "EUR", refillDay: null },
  { id: 2, name: "PLN", currencyCode: "PLN", refillDay: 5 },
];

describe("parsePocketForm", () => {
  it("accepts a valid pocket and uppercases the currency", () => {
    const result = parsePocketForm(fd({ name: "Subs", currencyCode: "eur", refillDay: "" }));
    expect(result).toEqual({
      ok: true,
      value: { name: "Subs", currencyCode: "EUR", refillDay: null },
    });
  });

  it("collects field errors", () => {
    const result = parsePocketForm(fd({ name: "", currencyCode: "", refillDay: "40" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveProperty("name");
      expect(result.errors).toHaveProperty("currencyCode");
      expect(result.errors).toHaveProperty("refillDay");
    }
  });
});

describe("parseSubscriptionForm", () => {
  const valid = {
    name: "Netflix",
    amount: "45.99",
    pocketId: "1",
    intervalMonths: "1",
    firstBillingDate: "2026-03-12",
    billingDay: "",
    endDate: "",
    notes: "",
    active: "on",
  };

  it("parses amounts to minor units, derives currency + billing day", () => {
    const result = parseSubscriptionForm(fd(valid), pockets);
    expect(result).toEqual({
      ok: true,
      value: {
        name: "Netflix",
        amountMinor: 4599,
        currencyCode: "EUR",
        pocketId: 1,
        intervalMonths: 1,
        firstBillingDate: "2026-03-12",
        billingDay: 12,
        endDate: null,
        active: true,
        notes: null,
      },
    });
  });

  it("treats a missing active checkbox as paused", () => {
    const { active: _drop, ...noCheckbox } = valid;
    const result = parseSubscriptionForm(fd(noCheckbox), pockets);
    expect(result.ok && result.value.active).toBe(false);
  });

  it("rejects an unknown pocket, bad amount and bad date", () => {
    const result = parseSubscriptionForm(
      fd({ ...valid, pocketId: "99", amount: "free", firstBillingDate: "nope" }),
      pockets,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["amount", "firstBillingDate", "pocketId"]);
    }
  });
});

describe("parseSettingsForm", () => {
  it("accepts valid preferences", () => {
    const result = parseSettingsForm(
      fd({
        defaultRefillDay: "11",
        timezone: "Europe/Warsaw",
        monthlyIncome: "12000",
        monthlyFood: "1400",
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: {
        defaultRefillDay: 11,
        timezone: "Europe/Warsaw",
        monthlyIncomeMinor: 1_200_000,
        monthlyFoodMinor: 140_000,
      },
    });
  });

  it("rejects an unknown timezone and out-of-range day", () => {
    const result = parseSettingsForm(
      fd({ defaultRefillDay: "0", timezone: "Mars/Olympus", monthlyIncome: "1", monthlyFood: "1" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveProperty("defaultRefillDay");
      expect(result.errors).toHaveProperty("timezone");
    }
  });
});

describe("parseFinancesForm", () => {
  it("parses income and food", () => {
    expect(parseFinancesForm(fd({ monthlyIncome: "9000", monthlyFood: "1200" }))).toEqual({
      ok: true,
      value: { monthlyIncomeMinor: 900_000, monthlyFoodMinor: 120_000 },
    });
  });

  it("rejects a bad amount", () => {
    const result = parseFinancesForm(fd({ monthlyIncome: "lots", monthlyFood: "1200" }));
    expect(result.ok).toBe(false);
  });
});

describe("parseCurrencyForm", () => {
  it("accepts a 3-letter code with a positive rate", () => {
    expect(
      parseCurrencyForm(fd({ code: "gbp", name: "Pound", symbol: "£", rateToBase: "5.2" })),
    ).toEqual({
      ok: true,
      value: { code: "GBP", name: "Pound", symbol: "£", rateToBase: 5.2 },
    });
  });

  it("rejects a malformed code or non-positive rate", () => {
    const result = parseCurrencyForm(fd({ code: "EURO", name: "", symbol: "", rateToBase: "0" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["code", "name", "rateToBase"]);
    }
  });
});
