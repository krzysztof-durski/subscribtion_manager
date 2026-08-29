import { data, Form, Link, redirect, useNavigation } from "react-router";

import {
  appDb,
  countSubscriptionsInPocket,
  createPocket,
  deletePocket,
  getCurrencies,
  getPockets,
  getSubscriptions,
  updatePocket,
} from "~/db";
import { parsePocketForm } from "~/forms";
import { Button, Card, Field, FormError, Input, PageHeader, Select, Table } from "~/ui";

import type { Route } from "./+types/pockets";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Pockets — Subscription Manager" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const db = appDb();
  const [pockets, currencies, subscriptions] = await Promise.all([
    getPockets(db),
    getCurrencies(db),
    getSubscriptions(db),
  ]);

  const subCount: Record<number, number> = {};
  for (const s of subscriptions) subCount[s.pocketId] = (subCount[s.pocketId] ?? 0) + 1;

  const editId = Number(new URL(request.url).searchParams.get("edit"));
  const editing = pockets.find((p) => p.id === editId) ?? null;

  return { pockets, currencies, subCount, editing };
}

export async function action({ request }: Route.ActionArgs) {
  const db = appDb();
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    const id = Number(form.get("id"));
    if (await countSubscriptionsInPocket(db, id)) {
      return data(
        { formError: "That pocket still has subscriptions — reassign or delete them first." },
        { status: 400 },
      );
    }
    await deletePocket(db, id);
    return redirect("/pockets");
  }

  const parsed = parsePocketForm(form);
  if (!parsed.ok) {
    return data(
      { errors: parsed.errors, values: Object.fromEntries(form) as Record<string, string> },
      { status: 400 },
    );
  }

  if (intent === "update") {
    await updatePocket(db, Number(form.get("id")), parsed.value);
  } else {
    await createPocket(db, parsed.value);
  }
  return redirect("/pockets");
}

export default function Pockets({ loaderData, actionData }: Route.ComponentProps) {
  const { pockets, currencies, subCount, editing } = loaderData;
  const errors = actionData && "errors" in actionData ? actionData.errors : {};
  const values = actionData && "values" in actionData ? actionData.values : undefined;
  const formError = actionData && "formError" in actionData ? actionData.formError : undefined;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";

  const field = (key: string, fallback: string) => values?.[key] ?? fallback;

  return (
    <>
      <PageHeader title="Pockets" />

      <Card title="Your pockets">
        {pockets.length === 0 ? (
          <p className="text-sm text-gray-500">None yet — add one below.</p>
        ) : (
          <Table
            head={
              <tr>
                <th className="py-1">Name</th>
                <th className="py-1">Currency</th>
                <th className="py-1">Refill day</th>
                <th className="py-1 text-right">Subs</th>
                <th className="py-1" />
              </tr>
            }
          >
            {pockets.map((pocket) => (
              <tr key={pocket.id}>
                <td className="py-1.5">{pocket.name}</td>
                <td className="py-1.5">{pocket.currencyCode}</td>
                <td className="py-1.5">{pocket.refillDay ?? "default"}</td>
                <td className="py-1.5 text-right tabular-nums">{subCount[pocket.id] ?? 0}</td>
                <td className="py-1.5 text-right">
                  <Link className="text-xs underline" to={`/pockets?edit=${pocket.id}`}>
                    Edit
                  </Link>
                  <Form method="post" className="ml-3 inline">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={pocket.id} />
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

      <Card title={editing ? `Edit "${editing.name}"` : "New pocket"}>
        <Form method="post" className="grid gap-4 sm:grid-cols-3" key={editing?.id ?? "new"}>
          <input type="hidden" name="intent" value={editing ? "update" : "create"} />
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

          <Field label="Name" error={errors.name}>
            <Input name="name" defaultValue={field("name", editing?.name ?? "")} required />
          </Field>

          <Field label="Currency" error={errors.currencyCode}>
            <Select
              name="currencyCode"
              defaultValue={field("currencyCode", editing?.currencyCode ?? "")}
              required
            >
              <option value="">Choose…</option>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Refill day"
            error={errors.refillDay}
            hint="Blank = use the default from Settings"
          >
            <Input
              name="refillDay"
              inputMode="numeric"
              defaultValue={field("refillDay", editing?.refillDay?.toString() ?? "")}
            />
          </Field>

          <div className="sm:col-span-3 flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {editing ? "Save changes" : "Add pocket"}
            </Button>
            {editing ? (
              <Link className="text-sm underline" to="/pockets">
                Cancel
              </Link>
            ) : null}
          </div>
          <div className="sm:col-span-3">
            <FormError message={formError} />
          </div>
        </Form>
      </Card>
    </>
  );
}
