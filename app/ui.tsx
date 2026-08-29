/** Small styling primitives shared by the route modules. */

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { NavLink } from "react-router";

const NAV = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/subscriptions", label: "Subscriptions", end: false },
  { to: "/pockets", label: "Pockets", end: false },
  { to: "/savings", label: "Savings", end: false },
  { to: "/settings", label: "Settings", end: false },
];

export function AppShell({ email, children }: { email: string | null; children: ReactNode }) {
  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold">Subscription Manager</span>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded px-2 py-1 ${
                    isActive
                      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          {email ? (
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{email}</span>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      {title ? <h2 className="mb-3 text-sm font-semibold text-gray-500">{title}</h2> : null}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900";

export function Input(props: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentPropsWithoutRef<"select">) {
  return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentPropsWithoutRef<"textarea">) {
  return <textarea {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Button({ className, ...props }: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...props}
      className={`rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300 ${className ?? ""}`}
    />
  );
}

export function Table({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500">{head}</thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
      </table>
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </p>
  );
}
