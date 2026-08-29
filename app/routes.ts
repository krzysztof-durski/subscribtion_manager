import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/dashboard.tsx"),
  route("subscriptions", "routes/subscriptions.tsx"),
  route("pockets", "routes/pockets.tsx"),
  route("settings", "routes/settings.tsx"),
  route("savings", "routes/savings.tsx"),
] satisfies RouteConfig;
