/**
 * Root Routes
 * Health check and browser listing
 */

import { Hono } from "hono";
import { discoverBrowsers } from "../../browsers/mod.ts";

export const rootRoutes = new Hono();

/** Health check */
rootRoutes.head("/", (c) => {
  return c.body(null, 204);
});

/** List available browsers */
rootRoutes.get("/", async (c) => {
  const browsers = await discoverBrowsers();
  return c.json({
    browsers: browsers.map((b) => ({
      type: b.type,
      name: b.name,
      path: b.executablePath,
    })),
  });
});
