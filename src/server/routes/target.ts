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

/** Navigate target to URL */
targetRoutes.put("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }

  const body = await c.req.json();
  if (!body.url) {
    return c.json({ error: "url required" }, 400);
  }

  const client = await connect({
    port: result.instance.launched.debuggingPort,
    target: result.target.id,
  });

  await client.Page.navigate({ url: body.url });
  await client.close();

  return c.json({ url: body.url });
});

/** Close target */
targetRoutes.delete("/:browser/:profile/:target", async (c) => {
  const result = await getTarget(
    c.req.param("browser"),
    c.req.param("profile"),
    c.req.param("target")
  );

  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
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
    return c.json({ error: result.error }, result.status);
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
