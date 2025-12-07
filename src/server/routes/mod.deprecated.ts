/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DEPRECATED - DO NOT USE                                               ║
 * ║                                                                            ║
 * ║  This module is LEGACY code kept for reference only.                       ║
 * ║  Use src/client/ and src/orchestrator/ instead.                            ║
 * ║                                                                            ║
 * ║  Active modules:                                                           ║
 * ║    - src/orchestrator/ (contract-driven REST framework)                    ║
 * ║    - src/client/ (contract-driven browser control client)                  ║
 * ║    - src/cli/ (CLI entry points)                                           ║
 * ║    - src/mcp/ (Model Context Protocol server)                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Routes Module Exports
 * @deprecated
 * @module
 */

import { Hono } from "hono";
import { targetRoutes } from "./target.deprecated.ts";
import { nodeRoutes } from "./node.deprecated.ts";
import { instanceRoutes } from "./instance.deprecated.ts";
import { browserRoutes } from "./browser.deprecated.ts";
import { rootRoutes } from "./root.deprecated.ts";

export { rootRoutes } from "./root.deprecated.ts";
export { browserRoutes } from "./browser.deprecated.ts";
export { instanceRoutes } from "./instance.deprecated.ts";
export { targetRoutes } from "./target.deprecated.ts";
export { nodeRoutes } from "./node.deprecated.ts";

export function create(): Hono {
  const app = new Hono();

  app.route("/", rootRoutes);
  app.route("/", browserRoutes);
  app.route("/", instanceRoutes);
  app.route("/", targetRoutes);
  app.route("/", nodeRoutes);

  return app;
}
