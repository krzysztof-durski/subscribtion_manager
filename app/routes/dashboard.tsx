import { data, Form, Link } from "react-router";

import { appDb, getAppData, markChargePaid, unmarkChargePaid } from "~/db";
import { buildDashboard } from "~/lib/dashboard";
import { isValidISODate, todayISOInTimeZone } from "~/lib/dates";
import { formatMinorByCode } from "~/lib/money";
import { Card, PageHeader, Stat, Table } from "~/ui";

import type { Route } from "./+types/dashboard";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Dashboard — Subscription Manager" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const appData = await getAppData(appDb());

  const override = new URL(request.url).searchParams.get("today");
  const usingOverride = override != null && isValidISODate(override);
  const todayISO = usingOverride ? override : todayISOInTimeZone(appData.settings.timezone);

  return {
    dashboard: buildDashboard(
      appData.pockets,
      appData.subscriptions,
      appData.currencies,
      appData.settings,
      todayISO,
      appData.paidCharges,
    ),
    currencies: appData.currencies,
    usingOverride,
    hasPockets: appData.pockets.length > 0,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = form.get("intent");
  const subscriptionId = Number(form.get("subscriptionId"));
  const dueDate = String(form.get("dueDate"));

  if (!Number.isInteger(subscriptionId) || !isValidISODate(dueDate)) {
    return data({ error: "Invalid charge reference" }, { status: 400 });
  }

  const db = appDb();
  if (intent === "markPaid") {
    await markChargePaid(db, subscriptionId, dueDate);
  } else if (intent === "unmarkPaid") {
    await unmarkChargePaid(db, subscriptionId, dueDate);
  }
  return { ok: true };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { dashboard, currencies, usingOverride, hasPockets } = loaderData;
  const money = (minor: number, code: string) => formatMinorByCode(minor, code, currencies);

  return (
    <>
      <PageHeader title="Dashboard" />

      <p className="mb-4 text-sm text-gray-500">
        As of <span className="font-medium tabular-nums">{dashboard.todayISO}</span>
        {usingOverride ? " (from ?today=… override)" : ""}
      </p>

      {!hasPockets ? (
        <Card>
          <p className="text-sm">
            No pockets yet. Add a{" "}
            <Link className="underline" to="/pockets">
              pocket
            </Link>{" "}
            and some{" "}
            <Link className="underline" to="/subscriptions">
              subscriptions
            </Link>{" "}
            to see balances.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-6">
            <Stat
              label={`Total across pockets (${dashboard.baseCurrencyCode})`}
              value={money(dashboard.grandTotalBaseMinor, dashboard.baseCurrencyCode)}
              sub="What should be set aside right now, everything converted"
            />
          </div>

          {dashboard.pockets.map(
            ({ balance, nextRefillDate, upcoming, expectedBalanceBaseMinor }) => {
              const code = balance.pocket.currencyCode;
              return (
                <Card key={balance.pocket.id} title={balance.pocket.name}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Stat
                      label="Should be in the pocket now"
                      value={money(balance.expectedBalanceMinor, code)}
                      sub={`≈ ${money(expectedBalanceBaseMinor, dashboard.baseCurrencyCode)}`}
                    />
                    <Stat
                      label={`Refill on the ${balance.refillDay}${ordinal(balance.refillDay)}`}
                      value={money(balance.monthlyRefillMinor, code)}
                      sub={`Next: ${nextRefillDate}`}
                    />
                    <Stat label="Subscriptions" value={String(balance.lines.length)} />
                  </div>

                  {balance.lines.length > 0 ? (
                    <div className="mt-4">
                      <Table
                        head={
                          <tr>
                            <th className="py-1">Subscription</th>
                            <th className="py-1 text-right">Set aside now</th>
                          </tr>
                        }
                      >
                        {balance.lines.map((line) => (
                          <tr key={line.subscription.id}>
                            <td className="py-1">{line.subscription.name}</td>
                            <td className="py-1 text-right tabular-nums">
                              {money(line.contributionMinor, code)}
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  ) : null}

                  {upcoming.length > 0 ? (
                    <div className="mt-4">
                      <h3 className="mb-1 text-xs font-semibold text-gray-500">
                        Charges before the next refill ({nextRefillDate})
                      </h3>
                      <Table
                        head={
                          <tr>
                            <th className="py-1">Date</th>
                            <th className="py-1">Subscription</th>
                            <th className="py-1 text-right">Amount</th>
                            <th className="py-1" />
                          </tr>
                        }
                      >
                        {upcoming.map((charge, i) => {
                          const struck = charge.paid ? "text-gray-400 line-through" : "";
                          return (
                            <tr key={`${charge.subscription.id}-${charge.date}-${i}`}>
                              <td className={`py-1 tabular-nums ${struck}`}>{charge.date}</td>
                              <td className={`py-1 ${struck}`}>{charge.subscription.name}</td>
                              <td className={`py-1 text-right tabular-nums ${struck}`}>
                                {money(charge.amountMinor, code)}
                              </td>
                              <td className="py-1 text-right">
                                <Form method="post" action="/?index" className="inline">
                                  <input
                                    type="hidden"
                                    name="subscriptionId"
                                    value={charge.subscription.id}
                                  />
                                  <input type="hidden" name="dueDate" value={charge.date} />
                                  <input
                                    type="hidden"
                                    name="intent"
                                    value={charge.paid ? "unmarkPaid" : "markPaid"}
                                  />
                                  <button className="text-xs text-blue-600 underline" type="submit">
                                    {charge.paid ? "undo" : "mark paid"}
                                  </button>
                                </Form>
                              </td>
                            </tr>
                          );
                        })}
                      </Table>
                    </div>
                  ) : null}
                </Card>
              );
            },
          )}
        </>
      )}
    </>
  );
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return "th";
  const last = n % 10;
  return last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th";
}
