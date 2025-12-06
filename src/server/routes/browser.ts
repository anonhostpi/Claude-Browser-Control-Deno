/**
 * Browser Routes
 * Browser info and profiles
 */

import { Hono } from "hono";
import { Browser, Type} from "../../browsers/mod.ts";
import { discoverProfiles } from "../../profiles/discover.ts";

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
