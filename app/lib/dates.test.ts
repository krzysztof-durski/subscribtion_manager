import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  compareISODate,
  daysInMonth,
  formatISODate,
  isValidISODate,
  maxISODate,
  minISODate,
  monthsBetween,
  parseISODate,
  todayISOInTimeZone,
} from "./dates";

describe("isValidISODate", () => {
  it("accepts real dates", () => {
    expect(isValidISODate("2026-08-15")).toBe(true);
    expect(isValidISODate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects malformed or impossible dates", () => {
    expect(isValidISODate("2026-8-15")).toBe(false);
    expect(isValidISODate("2026/08/15")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026-00-01")).toBe(false);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2025-02-29")).toBe(false); // not a leap year
    expect(isValidISODate("not-a-date")).toBe(false);
  });
});

describe("parseISODate / formatISODate", () => {
  it("round-trips", () => {
    expect(parseISODate("2026-08-15")).toEqual({ year: 2026, month: 8, day: 15 });
    expect(formatISODate({ year: 2026, month: 8, day: 15 })).toBe("2026-08-15");
  });

  it("zero-pads on format", () => {
    expect(formatISODate({ year: 26, month: 1, day: 3 })).toBe("0026-01-03");
  });

  it("throws on malformed input", () => {
    expect(() => parseISODate("2026-8-1")).toThrow(/ISO date/);
  });
});

describe("daysInMonth", () => {
  it("knows month lengths", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29); // divisible by 400
    expect(daysInMonth(1900, 2)).toBe(28); // divisible by 100 but not 400
  });

  it("throws outside 1-12", () => {
    expect(() => daysInMonth(2026, 0)).toThrow(/Month out of range/);
    expect(() => daysInMonth(2026, 13)).toThrow(/Month out of range/);
  });
});

describe("addMonths", () => {
  it("adds and subtracts", () => {
    expect(addMonths("2026-08-15", 1)).toBe("2026-09-15");
    expect(addMonths("2026-08-15", -2)).toBe("2026-06-15");
  });

  it("rolls the year over in both directions", () => {
    expect(addMonths("2026-11-10", 3)).toBe("2027-02-10");
    expect(addMonths("2026-02-10", -3)).toBe("2025-11-10");
  });

  it("clamps the day to the target month length", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-05-31", 1)).toBe("2026-06-30");
  });
});

describe("addDays", () => {
  it("adds and subtracts across month and year boundaries", () => {
    expect(addDays("2026-08-15", 1)).toBe("2026-08-16");
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
  });
});

describe("compareISODate / minISODate / maxISODate", () => {
  it("orders dates", () => {
    expect(compareISODate("2026-01-01", "2026-02-01")).toBe(-1);
    expect(compareISODate("2026-02-01", "2026-01-01")).toBe(1);
    expect(compareISODate("2026-01-01", "2026-01-01")).toBe(0);
  });

  it("picks the earlier / later", () => {
    expect(minISODate("2026-01-01", "2026-02-01")).toBe("2026-01-01");
    expect(maxISODate("2026-01-01", "2026-02-01")).toBe("2026-02-01");
    expect(minISODate("2026-03-01", "2026-03-01")).toBe("2026-03-01");
  });
});

describe("monthsBetween", () => {
  it("counts whole months with sign", () => {
    expect(monthsBetween("2026-01-15", "2026-01-20")).toBe(0);
    expect(monthsBetween("2025-09-15", "2026-08-15")).toBe(11);
    expect(monthsBetween("2026-08-15", "2025-09-15")).toBe(-11);
  });
});

describe("todayISOInTimeZone", () => {
  it("resolves the calendar date in the given zone", () => {
    const instant = new Date("2026-08-15T23:30:00Z");
    expect(todayISOInTimeZone("Europe/Warsaw", instant)).toBe("2026-08-16"); // UTC+2
    expect(todayISOInTimeZone("America/Los_Angeles", instant)).toBe("2026-08-15"); // UTC-7
    expect(todayISOInTimeZone("UTC", instant)).toBe("2026-08-15");
  });
});
