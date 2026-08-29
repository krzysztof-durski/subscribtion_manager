import { data, Form, Link, redirect, useNavigation } from "react-router";

import {
  appDb,
  deleteCurrency,
  getCurrencies,
  getPockets,
  getSettings,
  updateSettings,
  upsertCurrency,
} from "~/db";
import { parseCurrencyForm, parseSettingsForm } from "~/forms";
import { MINOR_UNITS_PER_MAJOR } from "~/lib/types";
import { Button, Card, Field, Input, PageHeader, Table } from "~/ui";

import type { Route } from "./+types/settings";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Settings — Subscription Manager" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const db = appDb();
  const [settings, currencies, pockets] = await Promise.all([
    getSettings(db),
    getCurrencies(db),
    getPockets(db),
  ]);
  const usedCodes = new Set(pockets.map((p) => p.currencyCode));
  const editCode = new URL(request.url).searchParams.get("editCurrency");
  const editingCurrency = currencies.find((c) => c.code === editCode) ?? null;
  return { settings, currencies, usedCodes: [...usedCodes], editingCurrency };
}

export async function action({ request }: Route.ActionArgs) {
  const db = appDb();
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "deleteCurrency") {
    await deleteCurrency(db, String(form.get("code")));
    return redirect("/settings");
  }

  if (intent === "currency") {
    const parsed = parseCurrencyForm(form);
    if (!parsed.ok) {
      return data(
        {
          scope: "currency",
          errors: parsed.errors,
          values: Object.fromEntries(form) as Record<string, string>,
        },
        { status: 400 },
      );
    }
    await upsertCurrency(db, parsed.value);
    return redirect("/settings");
  }

  const parsed = parseSettingsForm(form);
  if (!parsed.ok) {
    return data(
      {
        scope: "settings",
        errors: parsed.errors,
        values: Object.fromEntries(form) as Record<string, string>,
      },
      { status: 400 },
    );
  }
  await updateSettings(db, parsed.value);
  return redirect("/settings");
}

export default function Settings({ loaderData, actionData }: Route.ComponentProps) {
  const { settings, currencies, usedCodes, editingCurrency } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  const err = (scope: string) =>
    actionData && "scope" in actionData && actionData.scope === scope ? actionData.errors : {};
  const val = (scope: string) =>
    actionData && "scope" in actionData && actionData.scope === scope
      ? actionData.values
      : undefined;

  const sErr = err("settings");
  const sVal = val("settings");
  const cErr = err("currency");
  const cVal = val("currency");
  const major = (minor: number) => (minor / MINOR_UNITS_PER_MAJOR).toFixed(2);

  return (
    <>
      <PageHeader title="Settings" />

      <Card title="Preferences">
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="intent" value="settings" />

          <Field
            label="Default refill day"
            error={sErr.defaultRefillDay}
            hint="Used by pockets that don't set their own"
          >
            <Input
              name="defaultRefillDay"
              inputMode="numeric"
              defaultValue={sVal?.defaultRefillDay ?? String(settings.defaultRefillDay)}
              required
            />
          </Field>

          <Field label="Timezone" error={sErr.timezone} hint="IANA name, e.g. Europe/Warsaw">
            <Input name="timezone" defaultValue={sVal?.timezone ?? settings.timezone} required />
          </Field>

          <Field label={`Monthly income (${settings.baseCurrencyCode})`} error={sErr.monthlyIncome}>
            <Input
              name="monthlyIncome"
              inputMode="decimal"
              defaultValue={sVal?.monthlyIncome ?? major(settings.monthlyIncomeMinor)}
              required
            />
          </Field>

          <Field
            label={`Monthly food spending (${settings.baseCurrencyCode})`}
            error={sErr.monthlyFood}
          >
            <Input
              name="monthlyFood"
              inputMode="decimal"
              defaultValue={sVal?.monthlyFood ?? major(settings.monthlyFoodMinor)}
              required
            />
          </Field>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Save preferences
            </Button>
          </div>
        </Form>
      </Card>

      <Card title="Currencies & exchange rates">
        <Table
          head={
            <tr>
              <th className="py-1">Code</th>
              <th className="py-1">Name</th>
              <th className="py-1 text-right">Rate → {settings.baseCurrencyCode}</th>
              <th className="py-1" />
            </tr>
          }
        >
          {currencies.map((c) => (
            <tr key={c.code}>
              <td className="py-1.5 font-medium">
                {c.code}
                {c.isBase ? <span className="ml-2 text-xs text-gray-500">base</span> : null}
              </td>
              <td className="py-1.5">{c.name}</td>
              <td className="py-1.5 text-right tabular-nums">{c.rateToBase}</td>
              <td className="py-1.5 text-right">
                {c.isBase ? null : (
                  <>
                    <Link className="text-xs underline" to={`/settings?editCurrency=${c.code}`}>
                      Edit
                    </Link>
                    {usedCodes.includes(c.code) ? null : (
                      <Form method="post" className="ml-3 inline">
                        <input type="hidden" name="intent" value="deleteCurrency" />
                        <input type="hidden" name="code" value={c.code} />
                        <button className="text-xs text-red-600 underline" type="submit">
                          Delete
                        </button>
                      </Form>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>

        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold">
            {editingCurrency ? `Edit ${editingCurrency.code}` : "Add or update a currency"}
          </h3>
          <Form
            method="post"
            className="grid gap-4 sm:grid-cols-4"
            key={editingCurrency?.code ?? "new"}
          >
            <input type="hidden" name="intent" value="currency" />
            <Field label="Code" error={cErr.code}>
              <Input
                name="code"
                maxLength={3}
                defaultValue={cVal?.code ?? editingCurrency?.code ?? ""}
                readOnly={Boolean(editingCurrency)}
                required
              />
            </Field>
            <Field label="Name" error={cErr.name}>
              <Input
                name="name"
                defaultValue={cVal?.name ?? editingCurrency?.name ?? ""}
                required
              />
            </Field>
            <Field label="Symbol" error={cErr.symbol}>
              <Input name="symbol" defaultValue={cVal?.symbol ?? editingCurrency?.symbol ?? ""} />
            </Field>
            <Field label={`Rate → ${settings.baseCurrencyCode}`} error={cErr.rateToBase}>
              <Input
                name="rateToBase"
                inputMode="decimal"
                defaultValue={cVal?.rateToBase ?? editingCurrency?.rateToBase?.toString() ?? ""}
                required
              />
            </Field>
            <div className="sm:col-span-4 flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {editingCurrency ? "Save rate" : "Save currency"}
              </Button>
              {editingCurrency ? (
                <Link className="text-sm underline" to="/settings">
                  Cancel
                </Link>
              ) : null}
            </div>
          </Form>
        </div>
      </Card>
    </>
  );
}
