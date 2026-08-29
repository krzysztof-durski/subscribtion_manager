import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { AppShell } from "./ui";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

/**
 * Cloudflare Access sits in front of the app and adds an identity header to
 * every authenticated request. It is only shown in the nav — the app does no
 * auth of its own.
 */
export function loader({ request }: Route.LoaderArgs) {
  const email = request.headers.get("cf-access-authenticated-user-email");
  return { email: email && email.length > 0 ? email : null };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Subscription Manager</title>
        <Meta />
        <Links />
      </head>
      <body className="bg-white dark:bg-gray-950">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <AppShell email={loaderData.email}>
      <Outlet />
    </AppShell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">{message}</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{details}</p>
      {stack ? (
        <pre className="mt-4 w-full overflow-x-auto rounded bg-gray-100 p-4 text-xs dark:bg-gray-900">
          <code>{stack}</code>
        </pre>
      ) : null}
    </main>
  );
}
