import { data, Form, Link, redirect, useNavigation } from "react-router";

import {
  appDb,
  createSubscription,
  deleteSubscription,
  getAppData,
  updateSubscription,
} from "~/db";
import { parseSubscriptionForm } from "~/forms";
import { formatMinorByCode } from "~/lib/money";
import { MINOR_UNITS_PER_MAJOR } from "~/lib/types";
import { Button, Card, Field, Input, PageHeader, Select, Table, Textarea } from "~/ui";

import type { Route } from "./+types/subscriptions";

const INTERVALS = [
  { value: 1, label: "Monthly" },
  { value: 2, label: "Every 2 months" },
  { value: 3, label: "Quarterly" },
  { value: 6, label: "Every 6 months" },
  { value: 12, label: "Yearly" },
];

export function meta(): Route.MetaDescriptors {
  return [{ title: "Subscriptions — Subscription Manager" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const appData = await getAppData(appDb());
  const editId = Number(new URL(request.url).searchParams.get("edit"));
  const editing = appData.subscriptions.find((s) => s.id === editId) ?? null;
  return { ...appData, editing };
}

export async function action({ request }: Route.ActionArgs) {
  const db = appDb();
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await deleteSubscription(db, Number(form.get("id")));
    return redirect("/subscriptions");
  }

  const { pockets } = await getAppData(db);
  const parsed = parseSubscriptionForm(form, pockets);
  if (!parsed.ok) {
    return data(
      { errors: parsed.errors, values: Object.fromEntries(form) as Record<string, string> },
      { status: 400 },
    );
  }

  if (intent === "update") {
    await updateSubscription(db, Number(form.get("id")), parsed.value);
  } else {
    await createSubscription(db, parsed.value);
  }
  return redirect("/subscriptions");
}

export default function Subscriptions({ loaderData, actionData }: Route.ComponentProps) {
  const { subscriptions, pockets, currencies, editing } = loaderData;
  const errors = actionData && "errors" in actionData ? actionData.errors : {};
  const values = actionData && "values" in actionData ? actionData.values : undefined;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  const pocketName = (id: number) => pockets.find((p) => p.id === id)?.name ?? "?";
  const money = (minor: number, code: string) => formatMinorByCode(minor, code, currencies);
  const v = (key: string, fallback: string) => values?.[key] ?? fallback;

  return (
    <>
      <PageHeader title="Subscriptions">
        <Link className="text-sm underline" to="/pockets">
          Manage pockets
        </Link>
      </PageHeader>

      <Card title="Active & paused">
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing yet — add one below.</p>
        ) : (
          <Table
            head={
              <tr>
                <th className="py-1">Name</th>
                <th className="py-1 text-right">Amount</th>
                <th className="py-1">Every</th>
                <th className="py-1">Billed from</th>
                <th className="py-1">Pocket</th>
                <th className="py-1" />
              </tr>
            }
          >
            {subscriptions.map((s) => (
              <tr key={s.id} className={s.active ? "" : "text-gray-400"}>
                <td className="py-1.5">
                  {s.name}
                  {s.active ? "" : " (paused)"}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {money(s.amountMinor, s.currencyCode)}
                </td>
                <td className="py-1.5">
                  {s.intervalMonths === 1 ? "month" : `${s.intervalMonths} months`}
                </td>
                <td className="py-1.5 tabular-nums">{s.firstBillingDate}</td>
                <td className="py-1.5">{pocketName(s.pocketId)}</td>
                <td className="py-1.5 text-right">
                  <Link className="text-xs underline" to={`/subscriptions?edit=${s.id}`}>
                    Edit
                  </Link>
                  <Form method="post" className="ml-3 inline">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={s.id} />
                    <button className="text-xs text-red-600 underline" type="submit">
                      Delete
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title={editing ? `Edit "${editing.name}"` : "New subscription"}>
        {pockets.length === 0 ? (
          <p className="text-sm text-gray-500">
            Create a{" "}
            <Link className="underline" to="/pockets">
              pocket
            </Link>{" "}
            first.
          </p>
        ) : (
          <Form method="post" className="grid gap-4 sm:grid-cols-2" key={editing?.id ?? "new"}>
            <input type="hidden" name="intent" value={editing ? "update" : "create"} />
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

            <Field label="Name" error={errors.name}>
              <Input name="name" defaultValue={v("name", editing?.name ?? "")} required />
            </Field>

            <Field label="Amount (per charge)" error={errors.amount}>
              <Input
                name="amount"
                inputMode="decimal"
                placeholder="9.99"
                defaultValue={v(
                  "amount",
                  editing ? (editing.amountMinor / MINOR_UNITS_PER_MAJOR).toFixed(2) : "",
                )}
                required
              />
            </Field>

            <Field label="Pocket (sets the currency)" error={errors.pocketId}>
              <Select
                name="pocketId"
                defaultValue={v("pocketId", editing?.pocketId?.toString() ?? "")}
                required
              >
                <option value="">Choose…</option>
                {pockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.currencyCode})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Billed" error={errors.intervalMonths}>
              <Select
                name="intervalMonths"
                defaultValue={v("intervalMonths", (editing?.intervalMonths ?? 1).toString())}
              >
                {INTERVALS.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="First billing date"
              error={errors.firstBillingDate}
              hint="A real charge date — sets the day and, for multi-month plans, which months"
            >
              <Input
                type="date"
                name="firstBillingDate"
                defaultValue={v("firstBillingDate", editing?.firstBillingDate ?? "")}
                required
              />
            </Field>

            <Field label="End date (optional)" error={errors.endDate}>
              <Input
                type="date"
                name="endDate"
                defaultValue={v("endDate", editing?.endDate ?? "")}
              />
            </Field>

            <Field label="Notes (optional)">
              <Textarea name="notes" rows={2} defaultValue={v("notes", editing?.notes ?? "")} />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing ? editing.active : true}
              />
              Active
            </label>

            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {editing ? "Save changes" : "Add subscription"}
              </Button>
              {editing ? (
                <Link className="text-sm underline" to="/subscriptions">
                  Cancel
                </Link>
              ) : null}
            </div>
          </Form>
        )}
      </Card>
    </>
  );
}
