/**
 * Server App
 * Composes routes into Hono application
 */

import { Hono } from "hono";
import { rootRoutes, browserRoutes, instanceRoutes, targetRoutes, nodeRoutes } from "./routes/mod.ts";

export class App {
  readonly hono: Hono;

  constructor() {
    this.hono = new Hono();
    this.mountRoutes();
  }

  private mountRoutes(): void {
    this.hono.route("/", rootRoutes);
    this.hono.route("/", browserRoutes);
    this.hono.route("/", instanceRoutes);
    this.hono.route("/", targetRoutes);
    this.hono.route("/", nodeRoutes);
  }
}

/** Factory for backwards compatibility */
export function createApp(): Hono {
  return new App().hono;
}
