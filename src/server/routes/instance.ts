/**
 * Instance Routes
 * Browser instance lifecycle management
 */

import { Hono } from "hono";
import { getBrowser } from "../../browsers/mod.ts";
import { getProfile } from "../../profiles/mod.ts";
import { launchBrowser } from "../../launcher/mod.ts";
import { listTargets, createTarget } from "../../cdp/mod.ts";
import { registry } from "../registry.ts";

export const instanceRoutes = new Hono();

/** Check if instance is running */
instanceRoutes.head("/:browser/:profile", (c) => {
  const browser = c.req.param("browser");
  const profile = c.req.param("profile");

  if (registry.has({ browser, profile })) {
    return c.body(null, 204);
  }
  return c.body(null, 404);
});

/** Get instance info + targets */
instanceRoutes.get("/:browser/:profile", async (c) => {
  const browser = c.req.param("browser");
  const profile = c.req.param("profile");

  const instance = registry.get({ browser, profile });
  if (!instance) {
    return c.json({ error: "Instance not running" }, 404);
  }

  const targets = await listTargets({ port: instance.launched.debuggingPort });

  return c.json({
    browser: instance.browser.type,
    profile: instance.profile.displayName,
    port: instance.launched.debuggingPort,
    wsEndpoint: instance.launched.wsEndpoint,
    createdAt: instance.createdAt.toISOString(),
    targets: targets.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title,
      url: t.url,
    })),
  });
});
