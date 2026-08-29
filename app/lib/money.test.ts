import { describe, expect, it } from "vitest";

import {
  currencyByCode,
  formatMinor,
  formatMinorByCode,
  monthlyEquivalentMinor,
  parseMajorToMinor,
  toBaseMinor,
} from "./money";
import type { Currency } from "./types";

const PLN: Currency = {
  code: "PLN",
  name: "Polish zloty",
  symbol: "zł",
  rateToBase: 1,
  isBase: true,
};
const EUR: Currency = { code: "EUR", name: "Euro", symbol: "€", rateToBase: 4.3, isBase: false };

describe("currencyByCode", () => {
  it("finds a currency", () => {
    expect(currencyByCode([PLN, EUR], "EUR")).toBe(EUR);
  });

  it("throws when the currency is unknown", () => {
    expect(() => currencyByCode([PLN, EUR], "GBP")).toThrow(/Unknown currency/);
  });
});

describe("toBaseMinor", () => {
  it("leaves the base currency untouched", () => {
    expect(toBaseMinor(12345, PLN)).toBe(12345);
  });

  it("converts and rounds to whole minor units", () => {
    expect(toBaseMinor(1000, EUR)).toBe(4300); // 10.00 EUR -> 43.00 PLN
    expect(toBaseMinor(999, EUR)).toBe(4296); // round(4295.7)
  });
});

describe("monthlyEquivalentMinor", () => {
  it("divides the charge across the interval", () => {
    expect(monthlyEquivalentMinor(12000, 12)).toBe(1000);
    expect(monthlyEquivalentMinor(2000, 1)).toBe(2000);
    expect(monthlyEquivalentMinor(6000, 3)).toBe(2000);
  });

  it("rounds to whole minor units", () => {
    expect(monthlyEquivalentMinor(10000, 3)).toBe(3333); // round(3333.33)
  });

  it("rejects an interval below 1", () => {
    expect(() => monthlyEquivalentMinor(1000, 0)).toThrow(/intervalMonths/);
  });
});

describe("formatMinor", () => {
  it("renders two decimal places and the currency code", () => {
    expect(formatMinor(4295, PLN)).toBe("42.95 PLN");
    expect(formatMinor(0, EUR)).toBe("0.00 EUR");
    expect(formatMinor(5, PLN)).toBe("0.05 PLN");
  });

  it("adds thousands separators and keeps the sign", () => {
    expect(formatMinor(1234567, PLN)).toBe("12,345.67 PLN");
    expect(formatMinor(-4295, PLN)).toBe("-42.95 PLN");
  });

  it("formatMinorByCode resolves the currency first", () => {
    expect(formatMinorByCode(1000, "EUR", [PLN, EUR])).toBe("10.00 EUR");
  });
});

describe("parseMajorToMinor", () => {
  it("parses plain and decimal amounts", () => {
    expect(parseMajorToMinor("10")).toBe(1000);
    expect(parseMajorToMinor("9.99")).toBe(999);
    expect(parseMajorToMinor("0.1")).toBe(10);
    expect(parseMajorToMinor(" 12.50 ")).toBe(1250);
    expect(parseMajorToMinor("9,99")).toBe(999); // comma decimal
  });

  it("rejects junk, negatives and sub-cent precision", () => {
    expect(() => parseMajorToMinor("abc")).toThrow(/valid amount/);
    expect(() => parseMajorToMinor("-5")).toThrow(/valid amount/);
    expect(() => parseMajorToMinor("1.234")).toThrow(/valid amount/);
    expect(() => parseMajorToMinor("")).toThrow(/valid amount/);
  });
});
