/**
 * Node Routes
 * Individual DOM node management
 */

import { Hono } from "hono";
import { connect } from "../../cdp/mod.ts";
import { registry } from "../registry.ts";

export const nodeRoutes = new Hono();

/** Helper to get node from instance */
async function getNode(
  browser: string,
  profile: string,
  targetId: string,
  nodeId: string
) {
  const instance = registry.get({ browser, profile });
  if (!instance) return { error: "Instance not running", status: 404 };

  return { instance, targetId, nodeId: parseInt(nodeId) };
}
