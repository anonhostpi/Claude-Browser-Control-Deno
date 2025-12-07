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
 * Root Routes
 * Health check and browser listing
 * @deprecated
 * @module
 */

import { Hono } from "hono";
import { Browser } from "../../browsers/mod.deprecated.ts";

export const rootRoutes = new Hono();

/** Health check */
rootRoutes.on("HEAD", "/", (c) => {
  return c.body(null, 204);
});

/** List available browsers */
rootRoutes.get("/", async (c) => {
  const browsers = Browser.discover();
  return c.json({
    browsers: browsers.map((b) => ({
      type: b.type,
      name: b.name,
      path: b.executable,
    })),
  });
});
