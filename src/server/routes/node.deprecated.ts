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
 * Node Routes
 * Individual DOM node management
 * @deprecated
 * @module
 */

import { Hono } from "hono";
import { registry } from "../registry.deprecated.ts";
import { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";
import { CDP } from "../../cdp/mod.deprecated.ts";

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
nodeRoutes.on("HEAD", "/:browser/:profile/:target/:node", async (c) => {
  const result = await getNode(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target"),
    c.req.param("node")
  );

  if ("error" in result) {
    return c.body(null, result.status as StatusCode);
  }

  const client = await CDP({
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

/** Get node info or children */
nodeRoutes.get("/:browser/:profile/:target/:node", async (c) => {
  const result = await getNode(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target"),
    c.req.param("node")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  const client = await CDP({
    port: result.instance.launched.debuggingPort,
    target: result.targetId,
  });

  try {
    // Return children if requested
    if (c.req.query("children") !== undefined) {
      const { node } = await client.DOM.describeNode({ nodeId: result.nodeId, depth: 1 });
      const nodes = node.children?.map((child: { nodeId: number; nodeName: string; nodeType: number }) => ({
        nodeId: child.nodeId,
        nodeName: child.nodeName,
        nodeType: child.nodeType,
      })) ?? [];
      return c.json({ nodes });
    }

    // Return node info
    const { node } = await client.DOM.describeNode({ nodeId: result.nodeId });
    return c.json({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      nodeType: node.nodeType,
      nodeValue: node.nodeValue,
      attributes: node.attributes,
    });
  } catch {
    return c.json({ error: "Node not found" }, 404);
  } finally {
    await client.close();
  }
});

/** Interact with node (click, type, setAttribute) */
nodeRoutes.patch("/:browser/:profile/:target/:node", async (c) => {
  const result = await getNode(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target"),
    c.req.param("node")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  const body = await c.req.json();

  const client = await CDP({
    port: result.instance.launched.debuggingPort,
    target: result.targetId,
  });

  try {
    // Click the node
    if (body.click) {
      const { model } = await client.DOM.getBoxModel({ nodeId: result.nodeId });
      const x = (model.content[0] + model.content[2]) / 2;
      const y = (model.content[1] + model.content[5]) / 2;
      await client.Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await client.Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      return c.json({ clicked: true });
    }

    // Type into the node
    if (body.type) {
      await client.DOM.focus({ nodeId: result.nodeId });
      await client.Input.insertText({ text: body.type });
      return c.json({ typed: body.type });
    }

    // Set attribute
    if (body.setAttribute) {
      await client.DOM.setAttributeValue({
        nodeId: result.nodeId,
        name: body.setAttribute.name,
        value: body.setAttribute.value,
      });
      return c.json({ setAttribute: body.setAttribute });
    }

    return c.json({ error: "No action specified" }, 400);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  } finally {
    await client.close();
  }
});
