/**
 * Server App
 * Composes routes into Hono application
 */

import { Hono } from "hono";
import { rootRoutes, browserRoutes, instanceRoutes, targetRoutes, nodeRoutes } from "./routes/mod.ts";

export function createApp(): Hono {
  const app = new Hono();

  // Mount routes
  app.route("/", rootRoutes);
  app.route("/", browserRoutes);
  app.route("/", instanceRoutes);
  app.route("/", targetRoutes);
  app.route("/", nodeRoutes);

  return app;
}
