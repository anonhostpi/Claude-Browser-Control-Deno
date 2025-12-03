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
