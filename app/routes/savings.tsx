import { data, Form, useNavigation } from "react-router";

import { appDb, getAppData, updateFinances } from "~/db";
import { parseFinancesForm } from "~/forms";
import { formatMinorByCode } from "~/lib/money";
import { monthlySavings } from "~/lib/savings";
import { MINOR_UNITS_PER_MAJOR } from "~/lib/types";
import { Button, Card, Field, Input, PageHeader, Stat, Table } from "~/ui";

import type { Route } from "./+types/savings";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Savings — Subscription Manager" }];
}

export async function loader() {
  const appData = await getAppData(appDb());
  return {
    summary: monthlySavings(appData.settings, appData.subscriptions, appData.currencies),
    settings: appData.settings,
    currencies: appData.currencies,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const parsed = parseFinancesForm(form);
  if (!parsed.ok) {
    return data({ errors: parsed.errors }, { status: 400 });
  }
  await updateFinances(appDb(), parsed.value);
  return { ok: true as const };
}

export default function Savings({ loaderData, actionData }: Route.ComponentProps) {
  const { summary, settings, currencies } = loaderData;
  const base = settings.baseCurrencyCode;
  const errors = actionData && "errors" in actionData ? actionData.errors : {};
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  const baseMoney = (minor: number) => formatMinorByCode(minor, base, currencies);
  const major = (minor: number) => (minor / MINOR_UNITS_PER_MAJOR).toFixed(2);

  return (
    <>
      <PageHeader title="Savings" />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label={`Income (${base})`} value={baseMoney(summary.incomeMinor)} />
        <Stat
          label={`Subscriptions (${base})`}
          value={`− ${baseMoney(summary.subscriptionsBaseMinor)}`}
        />
        <Stat label={`Food (${base})`} value={`− ${baseMoney(summary.foodMinor)}`} />
        <Stat
          label={`Saved per month (${base})`}
          value={baseMoney(summary.savingsMinor)}
          sub={summary.savingsMinor < 0 ? "Spending more than you earn" : undefined}
        />
      </div>

      <Card title="Income & food">
        <Form method="post" className="grid gap-4 sm:grid-cols-2">
          <Field label={`Monthly income (${base})`} error={errors.monthlyIncome}>
            <Input
              name="monthlyIncome"
              inputMode="decimal"
              defaultValue={major(settings.monthlyIncomeMinor)}
              required
            />
          </Field>
          <Field label={`Monthly food spending (${base})`} error={errors.monthlyFood}>
            <Input
              name="monthlyFood"
              inputMode="decimal"
              defaultValue={major(settings.monthlyFoodMinor)}
              required
            />
          </Field>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              Save
            </Button>
            {actionData && "ok" in actionData ? (
              <span className="text-sm text-green-600">Saved.</span>
            ) : null}
          </div>
        </Form>
      </Card>

      <Card title="Subscription cost breakdown (monthly-equivalent)">
        {summary.lines.length === 0 ? (
          <p className="text-sm text-gray-500">No active subscriptions.</p>
        ) : (
          <Table
            head={
              <tr>
                <th className="py-1">Subscription</th>
                <th className="py-1 text-right">Per month</th>
                <th className="py-1 text-right">In {base}</th>
              </tr>
            }
          >
            {summary.lines.map((line) => (
              <tr key={line.subscription.id}>
                <td className="py-1.5">{line.subscription.name}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatMinorByCode(line.monthlyMinor, line.subscription.currencyCode, currencies)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {baseMoney(line.monthlyBaseMinor)}
                </td>
              </tr>
            ))}
            <tr className="font-medium">
              <td className="py-1.5">Total</td>
              <td className="py-1.5" />
              <td className="py-1.5 text-right tabular-nums">
                {baseMoney(summary.subscriptionsBaseMinor)}
              </td>
            </tr>
          </Table>
        )}

        {summary.perCurrency.length > 1 ? (
          <p className="mt-3 text-xs text-gray-500">
            By currency:{" "}
            {summary.perCurrency
              .map(
                (c) =>
                  `${formatMinorByCode(c.monthlyMinor, c.currencyCode, currencies)} → ${baseMoney(
                    c.monthlyBaseMinor,
                  )}`,
              )
              .join(" · ")}
          </p>
        ) : null}
      </Card>
    </>
  );
}
