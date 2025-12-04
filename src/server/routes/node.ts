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

/** Check if node exists */
nodeRoutes.head("/:browser/:profile/:target/:node", async (c) => {
  const result = await getNode(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target"),
    c.req.param("node")
  );

  if ("error" in result) {
    return c.body(null, result.status);
  }

  const client = await connect({
    port: result.instance.launched.debuggingPort,
    target: result.targetId,
  });

  try {
    await client.DOM.describeNode({ nodeId: result.nodeId });
    return c.body(null, 204);
  } catch {
    return c.body(null, 404);
  } finally {
    await client.close();
  }
});
