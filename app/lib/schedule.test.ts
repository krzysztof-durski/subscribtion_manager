import { describe, expect, it } from "vitest";

import { billingOccurrencesBetween, lastBillingOnOrBefore, nextBillingAfter } from "./schedule";
import type { Subscription } from "./types";

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    name: "Test",
    amountMinor: 1000,
    currencyCode: "EUR",
    pocketId: 1,
    intervalMonths: 1,
    firstBillingDate: "2026-01-12",
    billingDay: 12,
    endDate: null,
    active: true,
    notes: null,
    ...overrides,
  };
}

describe("billingOccurrencesBetween", () => {
  it("lists monthly charges within a half-open range", () => {
    expect(billingOccurrencesBetween(sub(), "2026-03-01", "2026-06-01")).toEqual([
      "2026-03-12",
      "2026-04-12",
      "2026-05-12",
    ]);
  });

  it("treats `from` as inclusive and `to` as exclusive", () => {
    expect(billingOccurrencesBetween(sub(), "2026-03-12", "2026-04-12")).toEqual(["2026-03-12"]);
  });

  it("clamps the billing day to short months", () => {
    const s = sub({ firstBillingDate: "2026-01-31", billingDay: 31 });
    expect(billingOccurrencesBetween(s, "2026-01-01", "2026-05-01")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("phases multi-month intervals to the anchor month", () => {
    const quarterly = sub({
      firstBillingDate: "2025-03-12",
      billingDay: 12,
      intervalMonths: 3,
    });
    expect(billingOccurrencesBetween(quarterly, "2025-01-01", "2026-01-01")).toEqual([
      "2025-03-12",
      "2025-06-12",
      "2025-09-12",
      "2025-12-12",
    ]);
  });

  it("never bills before the anchor or on/after the end date", () => {
    const s = sub({ firstBillingDate: "2026-03-12", endDate: "2026-06-12" });
    expect(billingOccurrencesBetween(s, "2026-01-01", "2027-01-01")).toEqual([
      "2026-03-12",
      "2026-04-12",
      "2026-05-12",
    ]);
  });

  it("returns nothing for an empty or inverted range", () => {
    expect(billingOccurrencesBetween(sub(), "2026-05-01", "2026-05-01")).toEqual([]);
    expect(billingOccurrencesBetween(sub(), "2026-06-01", "2026-03-01")).toEqual([]);
  });

  it("rejects an interval below 1", () => {
    expect(() =>
      billingOccurrencesBetween(sub({ intervalMonths: 0 }), "2026-01-01", "2026-02-01"),
    ).toThrow(/intervalMonths/);
  });
});

describe("lastBillingOnOrBefore", () => {
  it("returns the most recent charge, inclusive of the exact day", () => {
    expect(lastBillingOnOrBefore(sub(), "2026-05-20")).toBe("2026-05-12");
    expect(lastBillingOnOrBefore(sub(), "2026-05-12")).toBe("2026-05-12");
  });

  it("returns null before the first charge", () => {
    expect(lastBillingOnOrBefore(sub({ firstBillingDate: "2026-06-12" }), "2026-05-01")).toBeNull();
  });

  it("returns null when the anchor has passed but the first real charge day has not", () => {
    // anchor on the 10th, but bills on the 25th: no charge yet on the 20th.
    const s = sub({ firstBillingDate: "2026-01-10", billingDay: 25 });
    expect(lastBillingOnOrBefore(s, "2026-01-20")).toBeNull();
  });

  it("looks back a full year for an annual subscription", () => {
    const yearly = sub({ firstBillingDate: "2025-09-15", billingDay: 15, intervalMonths: 12 });
    expect(lastBillingOnOrBefore(yearly, "2026-08-15")).toBe("2025-09-15");
  });
});

describe("nextBillingAfter", () => {
  it("returns the next charge strictly after the date", () => {
    expect(nextBillingAfter(sub(), "2026-05-12")).toBe("2026-06-12");
    expect(nextBillingAfter(sub(), "2026-05-13")).toBe("2026-06-12");
  });

  it("returns the anchor charge when the date is before it", () => {
    expect(nextBillingAfter(sub({ firstBillingDate: "2026-06-12" }), "2026-01-01")).toBe(
      "2026-06-12",
    );
  });

  it("returns null once the subscription has ended", () => {
    expect(nextBillingAfter(sub({ endDate: "2026-06-12" }), "2026-06-12")).toBeNull();
  });
});
