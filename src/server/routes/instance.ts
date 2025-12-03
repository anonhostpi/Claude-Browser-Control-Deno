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

/** Launch instance (idempotent) */
instanceRoutes.put("/:browser/:profile", async (c) => {
  const browserType = c.req.param("browser");
  const profileName = c.req.param("profile");
  const key = { browser: browserType, profile: profileName };

  // Return existing if already running
  const existing = registry.get(key);
  if (existing) {
    return c.json({
      browser: existing.browser.type,
      profile: existing.profile.displayName,
      port: existing.launched.debuggingPort,
      wsEndpoint: existing.launched.wsEndpoint,
      created: false,
    });
  }

  // Get browser and profile
  const browser = await getBrowser(browserType);
  if (!browser) {
    return c.json({ error: "Browser not found" }, 404);
  }

  const profile = await getProfile(browser, profileName);

  // Parse query params
  const url = new URL(c.req.url);
  const headless = url.searchParams.get("headless") === "true";
  const port = url.searchParams.has("port")
    ? parseInt(url.searchParams.get("port")!)
    : undefined;

  // Launch
  const launched = await launchBrowser({
    browser,
    profile,
    headless,
    debuggingPort: port,
  });

  registry.set({
    key,
    browser,
    profile,
    launched,
    createdAt: new Date(),
  });

  return c.json({
    browser: browser.type,
    profile: profile.displayName,
    port: launched.debuggingPort,
    wsEndpoint: launched.wsEndpoint,
    created: true,
  }, 201);
});

/** Close instance */
instanceRoutes.delete("/:browser/:profile", async (c) => {
  const browser = c.req.param("browser");
  const profile = c.req.param("profile");
  const key = { browser, profile };

  const instance = registry.get(key);
  if (!instance) {
    return c.json({ error: "Instance not running" }, 404);
  }

  await instance.launched.close();
  registry.delete(key);

  return c.body(null, 204);
});
