/**
 * Target Routes
 * Individual target (tab/page) management
 */

import { Hono } from "hono";
import { listTargets, activateTarget, closeTarget, connect } from "../../cdp/mod.ts";
import { registry } from "../registry.ts";
import { ContentfulStatusCode, StatusCode } from "hono/utils/http-status";

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
targetRoutes.on("HEAD", "/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.body(null, result.status as StatusCode);
  }
  return c.body(null, 204);
});

/** Get target info, query nodes, or upgrade to WebSocket */
targetRoutes.get("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  // Check for WebSocket upgrade
  const upgradeHeader = c.req.header("upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    const wsUrl = result.target.webSocketDebuggerUrl;
    if (!wsUrl) {
      return c.json({ error: "Target has no WebSocket URL" }, 400);
    }

    const { socket: clientWs, response } = Deno.upgradeWebSocket(c.req.raw);
    const browserWs = new WebSocket(wsUrl);

    browserWs.onopen = () => {
      clientWs.onmessage = (e) => browserWs.send(e.data);
      browserWs.onmessage = (e) => clientWs.send(e.data);
    };

    clientWs.onclose = () => browserWs.close();
    browserWs.onclose = () => clientWs.close();
    browserWs.onerror = () => clientWs.close();
    clientWs.onerror = () => browserWs.close();

    return response;
  }

  // Handle XPath query
  const xpath = c.req.query("xpath");
  if (xpath) {
    const client = await connect({
      port: result.instance.launched.debuggingPort,
      target: result.target.id,
    });

    try {
      const { root } = await client.DOM.getDocument();
      const { nodeIds } = await client.DOM.performSearch({ query: xpath });
      return c.json({ nodes: nodeIds });
    } finally {
      await client.close();
    }
  }

  // Handle CSS selector query
  const css = c.req.query("css");
  if (css) {
    const client = await connect({
      port: result.instance.launched.debuggingPort,
      target: result.target.id,
    });

    try {
      const { root } = await client.DOM.getDocument();
      const { nodeId } = await client.DOM.querySelector({ nodeId: root.nodeId, selector: css });
      const { nodeIds } = await client.DOM.querySelectorAll({ nodeId: root.nodeId, selector: css });
      return c.json({ nodes: nodeIds });
    } finally {
      await client.close();
    }
  }

  return c.json({
    id: result.target.id,
    type: result.target.type,
    title: result.target.title,
    url: result.target.url,
  });
});

/** Close target */
targetRoutes.delete("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  await closeTarget(result.target.id, {
    port: result.instance.launched.debuggingPort,
  });

  return c.body(null, 204);
});

/** CDP passthrough */
targetRoutes.post("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  const body = await c.req.json();
  if (!body.method) {
    return c.json({ error: "method required" }, 400);
  }

  const client = await connect({
    port: result.instance.launched.debuggingPort,
    target: result.target.id,
  });

  try {
    const [domain, method] = body.method.split(".");
    const domainClient = client[domain as keyof typeof client];
    if (!domainClient || typeof domainClient[method] !== "function") {
      return c.json({ error: `Unknown method: ${body.method}` }, 400);
    }
    const response = await domainClient[method](body.params ?? {});
    return c.json(response);
  } finally {
    await client.close();
  }
});

/** Update target (navigate, inject, activate) */
targetRoutes.patch("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as ContentfulStatusCode);
  }

  const body = await c.req.json();

  const client = await connect({
    port: result.instance.launched.debuggingPort,
    target: result.target.id,
  });

  try {
    // Navigate if URL provided
    if (body.url) {
      await client.Page.navigate({ url: body.url });
      return c.json({ url: body.url });
    }

    // Execute script if provided
    if (body.script) {
      const evalResult = await client.Runtime.evaluate({
        expression: body.script,
        returnByValue: true,
      });
      return c.json({ result: evalResult.result });
    }

    // Activate target if requested
    if (body.activate) {
      await activateTarget(result.target.id, {
        port: result.instance.launched.debuggingPort,
      });
      return c.json({ activated: true });
    }

    return c.json({ error: "No action specified" }, 400);
  } finally {
    await client.close();
  }
});
