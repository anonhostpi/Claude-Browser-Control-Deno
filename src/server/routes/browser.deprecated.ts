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
 * Browser Routes
 * Browser info and profiles
 * @deprecated
 * @module
 */

import { Hono } from "hono";
import { Browser, Type} from "../../browsers/mod.deprecated.ts";
import { discoverProfiles } from "../../profiles/discover.deprecated.ts";

export const browserRoutes = new Hono();

/** Get browser info and profiles */
browserRoutes.get("/:browser", async (c) => {
  const browserType = c.req.param("browser");
  const browser = Browser.get(browserType as Type);

  if (!browser) {
    return c.json({ error: "Browser not found" }, 404);
  }

  const profiles = await discoverProfiles(browser);

  return c.json({
    type: browser.type,
    name: browser.name,
    path: browser.executable,
    userDataDir: browser.user_data,
    profiles: profiles.map((p) => ({
      name: p.name,
      displayName: p.display,
      isDefault: p.isDefault,
    })),
  });
});
