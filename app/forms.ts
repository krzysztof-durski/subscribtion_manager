/**
 * Form parsing for the route actions.
 *
 * Each parser turns a `FormData` into a typed input object (see `app/db/queries`)
 * or a map of field errors. Keeping this here — pure, synchronous, no I/O — keeps
 * the route actions to "parse -> call query -> redirect".
 */

import type {
  CurrencyInput,
  FinancesInput,
  PocketInput,
  SettingsInput,
  SubscriptionInput,
} from "~/db/queries";
import { isValidISODate, parseISODate } from "~/lib/dates";
import { parseMajorToMinor } from "~/lib/money";
import type { Pocket } from "~/lib/types";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function optionalStr(form: FormData, key: string): string | null {
  const value = str(form, key);
  return value === "" ? null : value;
}

function parseDayOfMonth(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

/** Parse a non-negative integer amount of minor units from a major-unit string. */
function parseAmount(raw: string, errors: Record<string, string>, key: string): number {
  try {
    return parseMajorToMinor(raw);
  } catch {
    errors[key] = "Enter an amount like 9.99";
    return 0;
  }
}

export function parsePocketForm(form: FormData): ParseResult<PocketInput> {
  const errors: Record<string, string> = {};

  const name = str(form, "name");
  if (!name) errors.name = "Required";

  const currencyCode = str(form, "currencyCode").toUpperCase();
  if (!currencyCode) errors.currencyCode = "Required";

  const refillRaw = str(form, "refillDay");
  let refillDay: number | null = null;
  if (refillRaw !== "") {
    refillDay = parseDayOfMonth(refillRaw);
    if (refillDay === null) errors.refillDay = "Enter a day 1-31, or leave blank";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, currencyCode, refillDay } };
}

export function parseSubscriptionForm(
  form: FormData,
  pockets: readonly Pocket[],
): ParseResult<SubscriptionInput> {
  const errors: Record<string, string> = {};

  const name = str(form, "name");
  if (!name) errors.name = "Required";

  const amountMinor = parseAmount(str(form, "amount"), errors, "amount");

  const pocketId = Number(str(form, "pocketId"));
  const pocket = pockets.find((p) => p.id === pocketId);
  if (!pocket) errors.pocketId = "Choose a pocket";
  // A subscription is always charged in its pocket's currency.
  const currencyCode = pocket?.currencyCode ?? "";

  const intervalMonths = Number(str(form, "intervalMonths"));
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) {
    errors.intervalMonths = "Enter a whole number of months (1 = monthly)";
  }

  const firstBillingDate = str(form, "firstBillingDate");
  if (!isValidISODate(firstBillingDate)) errors.firstBillingDate = "Enter a valid date";

  // The billing day is always the day-of-month of the first billing date — no
  // separate field. This keeps the anchor and the recurring day consistent.
  const billingDay = isValidISODate(firstBillingDate) ? parseISODate(firstBillingDate).day : null;

  const endDate = optionalStr(form, "endDate");
  if (endDate !== null && !isValidISODate(endDate))
    errors.endDate = "Enter a valid date or leave blank";

  const active = form.get("active") != null;
  const notes = optionalStr(form, "notes");

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      amountMinor,
      currencyCode,
      pocketId,
      intervalMonths,
      firstBillingDate,
      billingDay: billingDay as number,
      endDate,
      active,
      notes,
    },
  };
}

export function parseSettingsForm(form: FormData): ParseResult<SettingsInput> {
  const errors: Record<string, string> = {};

  const defaultRefillDay = parseDayOfMonth(str(form, "defaultRefillDay"));
  if (defaultRefillDay === null) errors.defaultRefillDay = "Enter a day 1-31";

  const timezone = str(form, "timezone");
  if (!timezone) errors.timezone = "Required";
  else {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    } catch {
      errors.timezone = "Unknown IANA timezone";
    }
  }

  const monthlyIncomeMinor = parseAmount(str(form, "monthlyIncome"), errors, "monthlyIncome");
  const monthlyFoodMinor = parseAmount(str(form, "monthlyFood"), errors, "monthlyFood");

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      defaultRefillDay: defaultRefillDay as number,
      timezone,
      monthlyIncomeMinor,
      monthlyFoodMinor,
    },
  };
}

export function parseFinancesForm(form: FormData): ParseResult<FinancesInput> {
  const errors: Record<string, string> = {};
  const monthlyIncomeMinor = parseAmount(str(form, "monthlyIncome"), errors, "monthlyIncome");
  const monthlyFoodMinor = parseAmount(str(form, "monthlyFood"), errors, "monthlyFood");
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { monthlyIncomeMinor, monthlyFoodMinor } };
}

export function parseCurrencyForm(form: FormData): ParseResult<CurrencyInput> {
  const errors: Record<string, string> = {};

  const code = str(form, "code").toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) errors.code = "Use a 3-letter code, e.g. GBP";

  const name = str(form, "name");
  if (!name) errors.name = "Required";

  const symbol = optionalStr(form, "symbol");

  const rateToBase = Number(str(form, "rateToBase"));
  if (!Number.isFinite(rateToBase) || rateToBase <= 0) {
    errors.rateToBase = "Enter a positive number";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { code, name, symbol, rateToBase } };
}
