import { describe, expect, it } from "vitest";

import { lastRefillOnOrBefore, nextRefillAfter, refillCount, refillDatesBetween } from "./refill";

describe("refillDatesBetween", () => {
  it("lists monthly refill dates in a half-open range", () => {
    expect(refillDatesBetween(11, "2026-01-01", "2026-04-01")).toEqual([
      "2026-01-11",
      "2026-02-11",
      "2026-03-11",
    ]);
  });

  it("includes `from` and excludes `to`", () => {
    expect(refillDatesBetween(11, "2026-01-11", "2026-02-11")).toEqual(["2026-01-11"]);
  });

  it("clamps the refill day to short months", () => {
    expect(refillDatesBetween(31, "2026-01-01", "2026-04-01")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("returns nothing for an empty or inverted range", () => {
    expect(refillDatesBetween(11, "2026-05-11", "2026-05-11")).toEqual([]);
    expect(refillDatesBetween(11, "2026-06-01", "2026-01-01")).toEqual([]);
  });

  it("rejects an out-of-range or non-integer refill day", () => {
    expect(() => refillDatesBetween(0, "2026-01-01", "2026-02-01")).toThrow(/refillDay/);
    expect(() => refillDatesBetween(32, "2026-01-01", "2026-02-01")).toThrow(/refillDay/);
    expect(() => refillDatesBetween(11.5, "2026-01-01", "2026-02-01")).toThrow(/refillDay/);
  });
});

describe("refillCount", () => {
  it("counts refills in the half-open interval (after, through]", () => {
    expect(refillCount(10, "2026-08-09", "2026-08-10")).toBe(1); // `through` day counts
    expect(refillCount(10, "2026-08-10", "2026-08-11")).toBe(0); // `after` day excluded
    expect(refillCount(10, "2026-08-01", "2026-08-15")).toBe(1);
  });

  it("returns 0 when the window is empty", () => {
    expect(refillCount(10, "2026-08-10", "2026-08-10")).toBe(0);
    expect(refillCount(10, "2026-09-01", "2026-08-01")).toBe(0);
  });

  it("counts the eleven refills since an annual charge (canonical scenario)", () => {
    expect(refillCount(10, "2025-09-15", "2026-08-15")).toBe(11);
    expect(refillCount(10, "2025-09-15", "2026-09-10")).toBe(12);
  });
});

describe("lastRefillOnOrBefore / nextRefillAfter", () => {
  it("finds the surrounding refill dates", () => {
    expect(lastRefillOnOrBefore(10, "2026-08-15")).toBe("2026-08-10");
    expect(lastRefillOnOrBefore(10, "2026-08-10")).toBe("2026-08-10");
    expect(nextRefillAfter(10, "2026-08-15")).toBe("2026-09-10");
    expect(nextRefillAfter(10, "2026-08-10")).toBe("2026-09-10");
  });

  it("crosses the year boundary", () => {
    expect(lastRefillOnOrBefore(10, "2026-01-05")).toBe("2025-12-10");
    expect(nextRefillAfter(10, "2026-12-15")).toBe("2027-01-10");
  });
});
