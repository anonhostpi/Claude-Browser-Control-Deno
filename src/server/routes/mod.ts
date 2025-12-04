/**
 * Routes Module Exports
 */

import { Hono } from "hono";
import { targetRoutes } from "./target.ts";
import { nodeRoutes } from "./node.ts";
import { instanceRoutes } from "./instance.ts";
import { browserRoutes } from "./browser.ts";
import { rootRoutes } from "./root.ts";

export { rootRoutes } from "./root.ts";
export { browserRoutes } from "./browser.ts";
export { instanceRoutes } from "./instance.ts";
export { targetRoutes } from "./target.ts";
export { nodeRoutes } from "./node.ts";

export function create(): Hono {
  const app = new Hono();

  app.route("/", rootRoutes);
  app.route("/", browserRoutes);
  app.route("/", instanceRoutes);
  app.route("/", targetRoutes);
  app.route("/", nodeRoutes);

  return app;
}
