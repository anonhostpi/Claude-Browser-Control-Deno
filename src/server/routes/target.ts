/**
 * Target Routes
 * Individual target (tab/page) management
 */

import { Hono } from "hono";
import { listTargets, activateTarget, closeTarget, connect } from "../../cdp/mod.ts";
import { registry } from "../registry.ts";

export const targetRoutes = new Hono();

/** Helper to get target from instance */
async function getTarget(
  browser: string,
  profile: string,
  targetId: string
) {
  const instance = registry.get({ browser, profile });
  if (!instance) return { error: "Instance not running", status: 404 };

  const targets = await listTargets({ port: instance.launched.debuggingPort });
  const target = targets.find((t) => t.id === targetId);
  if (!target) return { error: "Target not found", status: 404 };

  return { instance, target };
}

/** Check if target exists */
targetRoutes.head("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.body(null, result.status);
  }
  return c.body(null, 204);
});

/** Get target info */
targetRoutes.get("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }

  return c.json({
    id: result.target.id,
    type: result.target.type,
    title: result.target.title,
    url: result.target.url,
  });
});
