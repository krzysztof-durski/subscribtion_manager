/**
 * The seam between D1 and the domain layer.
 *
 * Every function here does database I/O and nothing else: it reads or writes
 * rows and maps them onto the plain `app/lib/types` shapes the calculations use.
 * No business math lives here.
 */

import { asc, eq } from "drizzle-orm";

import type { Currency, Pocket, Settings, Subscription } from "~/lib/types";

import type { Db } from "./client";
import { currencies, pockets, settings, subscriptions } from "./schema";

type CurrencyRow = typeof currencies.$inferSelect;
type PocketRow = typeof pockets.$inferSelect;
type SubscriptionRow = typeof subscriptions.$inferSelect;
type SettingsRow = typeof settings.$inferSelect;

const toCurrency = (r: CurrencyRow): Currency => ({
  code: r.code,
  name: r.name,
  symbol: r.symbol,
  rateToBase: r.rateToBase,
  isBase: r.isBase,
});

const toPocket = (r: PocketRow): Pocket => ({
  id: r.id,
  name: r.name,
  currencyCode: r.currencyCode,
  refillDay: r.refillDay,
});

const toSubscription = (r: SubscriptionRow): Subscription => ({
  id: r.id,
  name: r.name,
  amountMinor: r.amountMinor,
  currencyCode: r.currencyCode,
  pocketId: r.pocketId,
  intervalMonths: r.intervalMonths,
  firstBillingDate: r.firstBillingDate,
  billingDay: r.billingDay,
  endDate: r.endDate,
  active: r.active,
  notes: r.notes,
});

const toSettings = (r: SettingsRow): Settings => ({
  baseCurrencyCode: r.baseCurrencyCode,
  defaultRefillDay: r.defaultRefillDay,
  timezone: r.timezone,
  monthlyIncomeMinor: r.monthlyIncomeMinor,
  monthlyFoodMinor: r.monthlyFoodMinor,
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getCurrencies(db: Db): Promise<Currency[]> {
  const rows = await db.select().from(currencies).orderBy(asc(currencies.sortOrder));
  return rows.map(toCurrency);
}

export async function getPockets(db: Db): Promise<Pocket[]> {
  const rows = await db.select().from(pockets).orderBy(asc(pockets.name));
  return rows.map(toPocket);
}

export async function getSubscriptions(db: Db): Promise<Subscription[]> {
  const rows = await db.select().from(subscriptions).orderBy(asc(subscriptions.name));
  return rows.map(toSubscription);
}

export async function getSettings(db: Db): Promise<Settings> {
  const row = await db.select().from(settings).where(eq(settings.id, 1)).get();
  if (!row) throw new Error("settings row is missing — did the seed migration run?");
  return toSettings(row);
}

export interface AppData {
  currencies: Currency[];
  pockets: Pocket[];
  subscriptions: Subscription[];
  settings: Settings;
}

/** One round of reads for the dashboard and most other pages. */
export async function getAppData(db: Db): Promise<AppData> {
  const [currencyList, pocketList, subscriptionList, settingsRow] = await Promise.all([
    getCurrencies(db),
    getPockets(db),
    getSubscriptions(db),
    getSettings(db),
  ]);
  return {
    currencies: currencyList,
    pockets: pocketList,
    subscriptions: subscriptionList,
    settings: settingsRow,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface PocketInput {
  name: string;
  currencyCode: string;
  refillDay: number | null;
}

export async function createPocket(db: Db, input: PocketInput): Promise<void> {
  await db.insert(pockets).values(input);
}

export async function updatePocket(db: Db, id: number, input: PocketInput): Promise<void> {
  await db
    .update(pockets)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(pockets.id, id));
}

export async function deletePocket(db: Db, id: number): Promise<void> {
  await db.delete(pockets).where(eq(pockets.id, id));
}

export async function countSubscriptionsInPocket(db: Db, pocketId: number): Promise<number> {
  const rows = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.pocketId, pocketId));
  return rows.length;
}

export interface SubscriptionInput {
  name: string;
  amountMinor: number;
  currencyCode: string;
  pocketId: number;
  intervalMonths: number;
  firstBillingDate: string;
  billingDay: number;
  endDate: string | null;
  active: boolean;
  notes: string | null;
}

export async function createSubscription(db: Db, input: SubscriptionInput): Promise<void> {
  await db.insert(subscriptions).values(input);
}

export async function updateSubscription(
  db: Db,
  id: number,
  input: SubscriptionInput,
): Promise<void> {
  await db
    .update(subscriptions)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(subscriptions.id, id));
}

export async function deleteSubscription(db: Db, id: number): Promise<void> {
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}

export interface SettingsInput {
  defaultRefillDay: number;
  timezone: string;
  monthlyIncomeMinor: number;
  monthlyFoodMinor: number;
}

export async function updateSettings(db: Db, input: SettingsInput): Promise<void> {
  await db.update(settings).set(input).where(eq(settings.id, 1));
}

export interface FinancesInput {
  monthlyIncomeMinor: number;
  monthlyFoodMinor: number;
}

/** Update just the income / food figures (from the Savings page). */
export async function updateFinances(db: Db, input: FinancesInput): Promise<void> {
  await db.update(settings).set(input).where(eq(settings.id, 1));
}

export interface CurrencyInput {
  code: string;
  name: string;
  symbol: string | null;
  rateToBase: number;
}

/** Insert a new currency or update the rate/name/symbol of an existing one. */
export async function upsertCurrency(db: Db, input: CurrencyInput): Promise<void> {
  await db
    .insert(currencies)
    .values(input)
    .onConflictDoUpdate({
      target: currencies.code,
      set: { name: input.name, symbol: input.symbol, rateToBase: input.rateToBase },
    });
}

export async function deleteCurrency(db: Db, code: string): Promise<void> {
  await db.delete(currencies).where(eq(currencies.code, code));
}
