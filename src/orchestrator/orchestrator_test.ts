/**
 * Tests for Orchestrator Module
 *
 * Tests the declarative REST server/client framework including:
 * - Contract types
 * - Client HTTP operations
 * - Client utility generation
 * - Server route building
 * - End-to-end integration
 */

import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { Client } from "./client/client.ts";
import { create as createClientUtility, type ContractByName } from "./client/utility.ts";
import { build as buildRoutes } from "./server/builder.ts";
import { EndpointContract } from "./contract.ts";
import { JSONSchema, FromSchema } from "json-schema-to-ts";
import { toFileUrl } from "@std/path";
import { parse, detectFormat, load, loadSync, loadWithBase, getDefaultBase } from "./loader.ts";
import { transpile, transpileSync, getDefaultOutputPath } from "./transpile.ts";
import { contracts } from "./contracts/api.ts";

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_PORT = 9876;
const TEST_URL = `http://localhost:${TEST_PORT}`;

// Simple contract: GET with no request body
const getHealthContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
  name: "getHealth",
  path: "/health",
  method: "GET",
  description: "Health check endpoint",
  response: {
    type: "object",
    properties: {
      status: { type: "string", const: "ok" },
    },
    required: ["status"],
  } as const,
  module: "", // Will be set dynamically in tests
};

// Contract with request body: POST
const createItemContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
  name: "createItem",
  path: "/items",
  method: "POST",
  description: "Create a new item",
  request: {
    type: "object",
    properties: {
      name: { type: "string" },
      value: { type: "number" },
    },
    required: ["name", "value"],
  } as const,
  response: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      value: { type: "number" },
    },
    required: ["id", "name", "value"],
  } as const,
  module: "",
};

// Contract with nested path
const getItemContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
  name: "getItem",
  path: "/items/details",
  method: "GET",
  description: "Get item details",
  response: {
    type: "object",
    properties: {
      count: { type: "number" },
    },
    required: ["count"],
  } as const,
  module: "",
};

// Two contracts on same path with different request schemas (for dispatch testing)
const updateItemNameContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
  name: "updateItemName",
  path: "/items/update",
  method: "POST",
  description: "Update item name",
  request: {
    type: "object",
    properties: {
      type: { type: "string", const: "name" },
      name: { type: "string" },
    },
    required: ["type", "name"],
  } as const,
  response: {
    type: "object",
    properties: {
      updated: { type: "string", const: "name" },
    },
    required: ["updated"],
  } as const,
  module: "",
};

const updateItemValueContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
  name: "updateItemValue",
  path: "/items/update",
  method: "POST",
  description: "Update item value",
  request: {
    type: "object",
    properties: {
      type: { type: "string", const: "value" },
      value: { type: "number" },
    },
    required: ["type", "value"],
  } as const,
  response: {
    type: "object",
    properties: {
      updated: { type: "string", const: "value" },
    },
    required: ["updated"],
  } as const,
  module: "",
};

// ============================================================================
// Client Tests
// ============================================================================

Deno.test("Client: constructs correct URL with path", () => {
  const client = new Client("http://example.com");
  assertEquals(client.url, "http://example.com");
});

Deno.test("Client: alive returns false when server is down", async () => {
  const client = new Client("http://localhost:59999"); // Unlikely to be running
  const result = await client.alive();
  assertEquals(result, false);
});

Deno.test("Client: simple GET request", async () => {
  // Create a simple test server
  const controller = new AbortController();
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    () => new Response(JSON.stringify({ message: "hello" }), {
      headers: { "Content-Type": "application/json" },
    })
  );

  try {
    const client = new Client(TEST_URL);
    const result = await client.get();
    assertEquals(result, { message: "hello" });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: simple GET with path", async () => {
  const controller = new AbortController();
  let receivedPath = "";
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    (req) => {
      receivedPath = new URL(req.url).pathname;
      return new Response(JSON.stringify({ path: receivedPath }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const client = new Client(TEST_URL);
    await client.get("some/path");
    assertEquals(receivedPath, "/some/path");
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: POST with body", async () => {
  const controller = new AbortController();
  let receivedBody: unknown;
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    async (req) => {
      receivedBody = await req.json();
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const client = new Client(TEST_URL);
    await client.post({ foo: "bar", num: 42 });
    assertEquals(receivedBody, { foo: "bar", num: 42 });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: DELETE returns undefined for empty body", async () => {
  const controller = new AbortController();
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    () => new Response(null, { status: 204 })
  );

  try {
    const client = new Client(TEST_URL);
    const result = await client.delete("resource/123");
    assertEquals(result, undefined);
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: alive with specific code", async () => {
  const controller = new AbortController();
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    () => new Response(null, { status: 204 })
  );

  try {
    const client = new Client(TEST_URL);
    const result204 = await client.alive(undefined, 204);
    const result200 = await client.alive(undefined, 200);
    assertEquals(result204, true);
    assertEquals(result200, false);
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: parent URL propagation", () => {
  // Create a parent client
  const parent = new Client("http://localhost:9333");

  // Create child with path
  const child = new Client(parent, "chrome");
  assertEquals(child.url, "http://localhost:9333/chrome");

  // Create grandchild
  const grandchild = new Client(child, "default");
  assertEquals(grandchild.url, "http://localhost:9333/chrome/default");

  // Update parent URL - children should reflect the change
  parent.url = "http://localhost:8080";
  assertEquals(parent.url, "http://localhost:8080");
  assertEquals(child.url, "http://localhost:8080/chrome");
  assertEquals(grandchild.url, "http://localhost:8080/chrome/default");
});

Deno.test("Client: url setter breaks parent chain", () => {
  const parent = new Client("http://localhost:9333");
  const child = new Client(parent, "chrome");

  assertEquals(child.url, "http://localhost:9333/chrome");

  // Setting url directly breaks parent chain
  child.url = "http://different:8080/custom";
  assertEquals(child.url, "http://different:8080/custom");

  // Parent changes no longer affect child
  parent.url = "http://localhost:9999";
  assertEquals(child.url, "http://different:8080/custom");
});

Deno.test("Client: empty path inherits parent URL", () => {
  const parent = new Client("http://localhost:9333/api");
  const child = new Client(parent, "");

  assertEquals(child.url, "http://localhost:9333/api");
});

Deno.test("Client: PUT with body", async () => {
  const controller = new AbortController();
  let receivedBody: unknown;
  let receivedMethod = "";
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    async (req) => {
      receivedMethod = req.method;
      receivedBody = await req.json();
      return new Response(JSON.stringify({ updated: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const client = new Client(TEST_URL);
    const result = await client.put({ name: "updated" });
    assertEquals(receivedMethod, "PUT");
    assertEquals(receivedBody, { name: "updated" });
    assertEquals(result, { updated: true });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: PUT with path and body", async () => {
  const controller = new AbortController();
  let receivedPath = "";
  let receivedBody: unknown;
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    async (req) => {
      receivedPath = new URL(req.url).pathname;
      receivedBody = await req.json();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const client = new Client(TEST_URL);
    await client.put("resource/123", { value: 42 });
    assertEquals(receivedPath, "/resource/123");
    assertEquals(receivedBody, { value: 42 });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: PATCH with body", async () => {
  const controller = new AbortController();
  let receivedMethod = "";
  let receivedBody: unknown;
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    async (req) => {
      receivedMethod = req.method;
      receivedBody = await req.json();
      return new Response(JSON.stringify({ patched: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const client = new Client(TEST_URL);
    const result = await client.patch({ delta: "change" });
    assertEquals(receivedMethod, "PATCH");
    assertEquals(receivedBody, { delta: "change" });
    assertEquals(result, { patched: true });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("Client: HEAD request", async () => {
  const controller = new AbortController();
  let receivedMethod = "";
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    (req) => {
      receivedMethod = req.method;
      return new Response(null, { status: 200 });
    }
  );

  try {
    const client = new Client(TEST_URL);
    const result = await client.head("check");
    assertEquals(receivedMethod, "HEAD");
    assertEquals(result, undefined);
  } finally {
    controller.abort();
    await server.finished;
  }
});

// ============================================================================
// Client Utility Tests
// ============================================================================

Deno.test("createClientUtility: generates callable function", () => {
  const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
    name: "test",
    path: "/test",
    method: "GET",
    description: "Test",
    response: { type: "object" } as const,
    module: "",
  };

  const utility = createClientUtility(contract);
  assertEquals(typeof utility, "function");
});

Deno.test("createClientUtility: calls correct path and method", async () => {
  const controller = new AbortController();
  let receivedMethod = "";
  let receivedPath = "";

  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    (req) => {
      receivedMethod = req.method;
      receivedPath = new URL(req.url).pathname;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "apiTest",
      path: "/api/test",
      method: "GET",
      description: "Test endpoint",
      response: { type: "object" } as const,
      module: "",
    };

    const utility = createClientUtility(contract);
    const client = new Client(TEST_URL);
    await utility(client);

    assertEquals(receivedMethod, "GET");
    assertEquals(receivedPath, "/api/test");
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("createClientUtility: sends request body for POST", async () => {
  const controller = new AbortController();
  let receivedBody: unknown;

  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    async (req) => {
      receivedBody = await req.json();
      return new Response(JSON.stringify({ created: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "apiCreate",
      path: "/api/create",
      method: "POST",
      description: "Create something",
      request: {
        type: "object",
        properties: { name: { type: "string" } },
      } as const,
      response: { type: "object" } as const,
      module: "",
    };

    const utility = createClientUtility(contract);
    const client = new Client(TEST_URL);
    await utility(client, { name: "test-item" });

    assertEquals(receivedBody, { name: "test-item" });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("createClientUtility: HEAD returns undefined", async () => {
  const controller = new AbortController();
  let receivedMethod = "";

  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    (req) => {
      receivedMethod = req.method;
      return new Response(null, { status: 200 });
    }
  );

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "healthCheck",
      path: "/health",
      method: "HEAD",
      description: "Health check",
      response: { type: "null" } as const,
      module: "",
    };

    const utility = createClientUtility(contract);
    const client = new Client(TEST_URL);
    const result = await utility(client);

    assertEquals(receivedMethod, "HEAD");
    assertEquals(result, undefined);
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("createClientUtility: DELETE returns response body", async () => {
  const controller = new AbortController();
  let receivedMethod = "";

  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    (req) => {
      receivedMethod = req.method;
      return new Response(JSON.stringify({ deleted: true, count: 5 }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "deleteItems",
      path: "/items",
      method: "DELETE",
      description: "Delete items",
      response: {
        type: "object",
        properties: {
          deleted: { type: "boolean" },
          count: { type: "number" },
        },
      } as const,
      module: "",
    };

    const utility = createClientUtility(contract);
    const client = new Client(TEST_URL);
    const result = await utility(client);

    assertEquals(receivedMethod, "DELETE");
    assertEquals(result, { deleted: true, count: 5 });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("createClientUtility: PUT sends body and returns response", async () => {
  const controller = new AbortController();
  let receivedMethod = "";
  let receivedBody: unknown;

  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    async (req) => {
      receivedMethod = req.method;
      receivedBody = await req.json();
      return new Response(JSON.stringify({ replaced: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "replaceItem",
      path: "/item",
      method: "PUT",
      description: "Replace item",
      request: {
        type: "object",
        properties: { content: { type: "string" } },
      } as const,
      response: {
        type: "object",
        properties: { replaced: { type: "boolean" } },
      } as const,
      module: "",
    };

    const utility = createClientUtility(contract);
    const client = new Client(TEST_URL);
    const result = await utility(client, { content: "new content" });

    assertEquals(receivedMethod, "PUT");
    assertEquals(receivedBody, { content: "new content" });
    assertEquals(result, { replaced: true });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("createClientUtility: PATCH sends body and returns response", async () => {
  const controller = new AbortController();
  let receivedMethod = "";
  let receivedBody: unknown;

  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    async (req) => {
      receivedMethod = req.method;
      receivedBody = await req.json();
      return new Response(JSON.stringify({ patched: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "patchItem",
      path: "/item",
      method: "PATCH",
      description: "Patch item",
      request: {
        type: "object",
        properties: { delta: { type: "string" } },
      } as const,
      response: {
        type: "object",
        properties: { patched: { type: "boolean" } },
      } as const,
      module: "",
    };

    const utility = createClientUtility(contract);
    const client = new Client(TEST_URL);
    const result = await utility(client, { delta: "change" });

    assertEquals(receivedMethod, "PATCH");
    assertEquals(receivedBody, { delta: "change" });
    assertEquals(result, { patched: true });
  } finally {
    controller.abort();
    await server.finished;
  }
});

Deno.test("createClientUtility: POST without request schema sends no body", async () => {
  const controller = new AbortController();
  let receivedMethod = "";
  let receivedContentType: string | null = null;

  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    (req) => {
      receivedMethod = req.method;
      receivedContentType = req.headers.get("content-type");
      return new Response(JSON.stringify({ triggered: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  );

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "triggerAction",
      path: "/trigger",
      method: "POST",
      description: "Trigger an action without body",
      // No request schema
      response: {
        type: "object",
        properties: { triggered: { type: "boolean" } },
      } as const,
      module: "",
    };

    const utility = createClientUtility(contract);
    const client = new Client(TEST_URL);
    const result = await utility(client);

    assertEquals(receivedMethod, "POST");
    assertEquals(receivedContentType, null); // No body means no content-type
    assertEquals(result, { triggered: true });
  } finally {
    controller.abort();
    await server.finished;
  }
});

// ============================================================================
// Server Builder Tests
// ============================================================================

Deno.test("RouteBuilder: builds Hono app from contracts", async () => {
  // Create a temporary module for the handler
  const handlerCode = `export default () => ({ status: "ok" });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/health_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getHealthContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);
    assertExists(app);
    assertExists(app.fetch);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: resolves relative module paths with base URL", async () => {
  const handlerCode = `export default () => ({ status: "ok" });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/health_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getHealthContract,
      module: "./health_handler.ts", // relative path
    };

    // Pass the temp directory as base URL
    const baseUrl = toFileUrl(tempDir + "/").href;
    const app = await buildRoutes([contract], baseUrl);

    const request = new Request("http://localhost/health", { method: "GET" });
    const response = await app.fetch(request);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body, { status: "ok" });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: resolves nested relative module paths with base URL", async () => {
  const handlerCode = `export default () => ({ count: 42 });`;
  const tempDir = await Deno.makeTempDir();
  // Create a nested directory structure
  const handlersDir = `${tempDir}/handlers`;
  await Deno.mkdir(handlersDir);
  const modulePath = `${handlersDir}/details.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getItemContract,
      module: "./handlers/details.ts", // nested relative path
    };

    const baseUrl = toFileUrl(tempDir + "/").href;
    const app = await buildRoutes([contract], baseUrl);

    const request = new Request("http://localhost/items/details", { method: "GET" });
    const response = await app.fetch(request);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body, { count: 42 });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: handles GET request correctly", async () => {
  const handlerCode = `export default () => ({ status: "ok" });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/health_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getHealthContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    const request = new Request("http://localhost/health", { method: "GET" });
    const response = await app.fetch(request);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body, { status: "ok" });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: validates request body against schema", async () => {
  const handlerCode = `export default (input) => ({ id: "123", name: input.name, value: input.value });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/create_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...createItemContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    // Valid request
    const validRequest = new Request("http://localhost/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test", value: 42 }),
    });
    const validResponse = await app.fetch(validRequest);
    assertEquals(validResponse.status, 200);

    const body = await validResponse.json();
    assertEquals(body.name, "test");
    assertEquals(body.value, 42);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: returns 422 for non-matching schema", async () => {
  const handlerCode = `export default (input) => ({ id: "123", name: input.name, value: input.value });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/create_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...createItemContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    // Invalid request (missing required field)
    const invalidRequest = new Request("http://localhost/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }), // missing 'value'
    });
    const invalidResponse = await app.fetch(invalidRequest);
    assertEquals(invalidResponse.status, 422);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: handles nested routes", async () => {
  const handlerCode = `export default () => ({ count: 5 });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/details_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getItemContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    const request = new Request("http://localhost/items/details", { method: "GET" });
    const response = await app.fetch(request);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body, { count: 5 });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: dispatches to correct handler based on request schema", async () => {
  const nameHandlerCode = `export default () => ({ updated: "name" });`;
  const valueHandlerCode = `export default () => ({ updated: "value" });`;
  const tempDir = await Deno.makeTempDir();
  const nameModulePath = `${tempDir}/name_handler.ts`;
  const valueModulePath = `${tempDir}/value_handler.ts`;
  await Deno.writeTextFile(nameModulePath, nameHandlerCode);
  await Deno.writeTextFile(valueModulePath, valueHandlerCode);

  try {
    const nameContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...updateItemNameContract,
      module: toFileUrl(nameModulePath).href,
    };
    const valueContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...updateItemValueContract,
      module: toFileUrl(valueModulePath).href,
    };

    const app = await buildRoutes([nameContract, valueContract]);

    // Request matching name contract
    const nameRequest = new Request("http://localhost/items/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "name", name: "new-name" }),
    });
    const nameResponse = await app.fetch(nameRequest);
    const nameBody = await nameResponse.json();
    assertEquals(nameBody, { updated: "name" });

    // Request matching value contract
    const valueRequest = new Request("http://localhost/items/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "value", value: 100 }),
    });
    const valueResponse = await app.fetch(valueRequest);
    const valueBody = await valueResponse.json();
    assertEquals(valueBody, { updated: "value" });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: returns 502 for invalid response from handler", async () => {
  // Handler returns data that doesn't match response schema
  const handlerCode = `export default () => ({ wrong: "field" });`; // Should return { status: "ok" }
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/bad_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getHealthContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    const request = new Request("http://localhost/health", { method: "GET" });
    const response = await app.fetch(request);

    assertEquals(response.status, 502);
    const body = await response.json();
    assertEquals(body.message, "Invalid response from server");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: JSON body takes precedence over URL params", async () => {
  const handlerCode = `export default (input) => ({ received: input.name });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "testBodyPrecedence",
      path: "/test",
      method: "POST",
      description: "Test body precedence",
      request: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      } as const,
      response: {
        type: "object",
        properties: { received: { type: "string" } },
        required: ["received"],
      } as const,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    // POST with both JSON body and URL params - body should win
    const request = new Request("http://localhost/test?name=fromUrl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "fromBody" }),
    });
    const response = await app.fetch(request);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.received, "fromBody"); // Body takes precedence
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: GET without body falls back to URL params", async () => {
  const handlerCode = `export default (input) => ({ received: input.name, count: input.count });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "testGetUrlParams",
      path: "/test",
      method: "GET",
      description: "Test GET with URL params",
      request: {
        type: "object",
        properties: {
          name: { type: "string" },
          count: { type: "number" },
        },
        required: ["name", "count"],
      } as const,
      response: {
        type: "object",
        properties: {
          received: { type: "string" },
          count: { type: "number" },
        },
        required: ["received", "count"],
      } as const,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    // GET with URL params only (count=42 should be parsed as number)
    const request = new Request("http://localhost/test?name=fromUrl&count=42", {
      method: "GET",
    });
    const response = await app.fetch(request);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.received, "fromUrl");
    assertEquals(body.count, 42); // Should be parsed as number
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: POST without body falls back to URL params", async () => {
  const handlerCode = `export default (input) => ({ received: input.name });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "testPostUrlFallback",
      path: "/test",
      method: "POST",
      description: "Test POST with URL params fallback",
      request: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      } as const,
      response: {
        type: "object",
        properties: { received: { type: "string" } },
        required: ["received"],
      } as const,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    // POST without body, params in URL
    const request = new Request("http://localhost/test?name=fromUrl", {
      method: "POST",
    });
    const response = await app.fetch(request);
    const body = await response.json();

    assertEquals(response.status, 200);
    assertEquals(body.received, "fromUrl");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("RouteBuilder: HEAD with URL params works", async () => {
  const handlerCode = `export default (input) => ({ exists: input.id === 123 });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      name: "testHeadUrlParams",
      path: "/check",
      method: "HEAD",
      description: "Test HEAD with URL params",
      request: {
        type: "object",
        properties: { id: { type: "number" } },
        required: ["id"],
      } as const,
      response: {
        type: "object",
        properties: { exists: { type: "boolean" } },
        required: ["exists"],
      } as const,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    // HEAD with URL params (Fetch spec doesn't allow body on GET/HEAD)
    // "123" in URL will be JSON.parsed to number 123
    const request = new Request("http://localhost/check?id=123", {
      method: "HEAD",
    });
    const response = await app.fetch(request);

    // HEAD returns no body but should succeed
    assertEquals(response.status, 200);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test("Integration: full roundtrip with client and server", async () => {
  const handlerCode = `export default () => ({ status: "ok" });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/health_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  const controller = new AbortController();

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getHealthContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    // Start server with Hono app
    const server = Deno.serve(
      { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
      app.fetch
    );

    // Create client utility from same contract
    const checkHealth = createClientUtility(contract);
    const client = new Client(TEST_URL);

    // Make request through client
    const result = await checkHealth(client);
    assertEquals(result, { status: "ok" });

    controller.abort();
    await server.finished;
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: POST with typed request/response", async () => {
  const handlerCode = `export default (input) => ({ id: crypto.randomUUID(), name: input.name, value: input.value });`;
  const tempDir = await Deno.makeTempDir();
  const modulePath = `${tempDir}/create_handler.ts`;
  await Deno.writeTextFile(modulePath, handlerCode);

  const controller = new AbortController();

  try {
    const contract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...createItemContract,
      module: toFileUrl(modulePath).href,
    };

    const app = await buildRoutes([contract]);

    const server = Deno.serve(
      { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
      app.fetch
    );

    const createItem = createClientUtility(contract);
    const client = new Client(TEST_URL);

    const result = await createItem(client, { name: "Widget", value: 99 }) as {
      id: string;
      name: string;
      value: number;
    };

    assertExists(result.id);
    assertEquals(result.name, "Widget");
    assertEquals(result.value, 99);

    controller.abort();
    await server.finished;
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: multiple routes at different paths", async () => {
  const healthCode = `export default () => ({ status: "ok" });`;
  const detailsCode = `export default () => ({ count: 42 });`;
  const tempDir = await Deno.makeTempDir();
  const healthPath = `${tempDir}/health.ts`;
  const detailsPath = `${tempDir}/details.ts`;
  await Deno.writeTextFile(healthPath, healthCode);
  await Deno.writeTextFile(detailsPath, detailsCode);

  const controller = new AbortController();

  try {
    const healthContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getHealthContract,
      module: toFileUrl(healthPath).href,
    };
    const detailsContract: EndpointContract<JSONSchema, JSONSchema, JSONSchema> = {
      ...getItemContract,
      module: toFileUrl(detailsPath).href,
    };

    const app = await buildRoutes([healthContract, detailsContract]);

    const server = Deno.serve(
      { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
      app.fetch
    );

    const client = new Client(TEST_URL);

    const healthResult = await client.get("health");
    assertEquals(healthResult, { status: "ok" });

    const detailsResult = await client.get("items/details");
    assertEquals(detailsResult, { count: 42 });

    controller.abort();
    await server.finished;
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("Integration: loadWithBase provides correct base for server builder", async () => {
  // This test verifies the full flow:
  // 1. Load contracts from a file without explicit base
  // 2. loadWithBase returns base from Deno.mainModule
  // 3. Server builder uses that base to resolve module paths

  // Create handler in the orchestrator directory (where Deno.mainModule points during tests)
  const handlerCode = `export default () => ({ integration: "success" });`;
  const handlerPath = new URL("./test_integration_handler.ts", import.meta.url);
  const handlerFilePath = handlerPath.pathname.startsWith("/")
    ? (Deno.build.os === "windows" ? handlerPath.pathname.slice(1) : handlerPath.pathname)
    : handlerPath.pathname;

  await Deno.writeTextFile(handlerFilePath, handlerCode);

  // Create a contract file in a temp directory (simulating user's contract file)
  const tempDir = await Deno.makeTempDir();
  const contractPath = `${tempDir}/contracts.yaml`;
  const contractYaml = `
contracts:
  - name: integrationTest
    path: /integration-test
    method: GET
    module: test_integration_handler.ts
    response:
      type: object
      properties:
        integration:
          type: string
`;
  await Deno.writeTextFile(contractPath, contractYaml);

  const controller = new AbortController();

  try {
    // Load contracts - since no base is specified, it uses Deno.mainModule directory
    const loaded = await loadWithBase(contractPath);

    // Verify base is the orchestrator directory (where Deno.mainModule points)
    assertEquals(loaded.base.endsWith("/src/orchestrator/"), true);
    assertEquals(loaded.originalBase, undefined);

    // Build server with the resolved base
    const app = await buildRoutes(loaded.contracts, loaded.base);

    const server = Deno.serve(
      { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
      app.fetch
    );

    // Make request and verify handler was found and executed
    const client = new Client(TEST_URL);
    const result = await client.get("integration-test") as { integration: string };

    assertEquals(result.integration, "success");

    controller.abort();
    await server.finished;
  } finally {
    // Cleanup
    await Deno.remove(tempDir, { recursive: true });
    try {
      await Deno.remove(handlerFilePath);
    } catch {
      // Ignore if already removed
    }
  }
});

// ============================================================================
// Contract Loader Tests
// ============================================================================

Deno.test("detectFormat: detects JSON files", () => {
  assertEquals(detectFormat("contracts.json"), "json");
  assertEquals(detectFormat("/path/to/contracts.json"), "json");
});

Deno.test("detectFormat: detects YAML files", () => {
  assertEquals(detectFormat("contracts.yaml"), "yaml");
  assertEquals(detectFormat("contracts.yml"), "yaml");
  assertEquals(detectFormat("/path/to/contracts.YAML"), "yaml");
});

Deno.test("detectFormat: detects TOML files", () => {
  assertEquals(detectFormat("contracts.toml"), "toml");
  assertEquals(detectFormat("/path/to/config.toml"), "toml");
});

Deno.test("detectFormat: throws on unknown extension", () => {
  assertThrows(() => detectFormat("contracts.txt"), Error, "Unknown file extension");
});

Deno.test("parse: parses JSON contract", () => {
  const json = JSON.stringify({
    name: "health",
    path: "/health",
    method: "GET",
    description: "Health check",
    module: "./handlers/health.ts",
    response: { type: "object" },
  });

  const contracts = parse(json, "json");
  assertEquals(contracts.length, 1);
  assertEquals(contracts[0].path, "/health");
  assertEquals(contracts[0].method, "GET");
});

Deno.test("parse: parses JSON array of contracts", () => {
  const json = JSON.stringify([
    {
      name: "health",
      path: "/health",
      method: "GET",
      module: "./handlers/health.ts",
      response: { type: "object" },
    },
    {
      name: "items",
      path: "/items",
      method: "POST",
      module: "./handlers/items.ts",
      response: { type: "object" },
      request: { type: "object" },
    },
  ]);

  const contracts = parse(json, "json");
  assertEquals(contracts.length, 2);
  assertEquals(contracts[0].path, "/health");
  assertEquals(contracts[1].path, "/items");
});

Deno.test("parse: parses YAML contract", () => {
  const yaml = `
name: health
path: /health
method: GET
description: Health check endpoint
module: ./handlers/health.ts
response:
  type: object
  properties:
    status:
      type: string
`;

  const contracts = parse(yaml, "yaml");
  assertEquals(contracts.length, 1);
  assertEquals(contracts[0].path, "/health");
  assertEquals(contracts[0].method, "GET");
  assertEquals(contracts[0].description, "Health check endpoint");
});

Deno.test("parse: parses YAML array of contracts", () => {
  const yaml = `
- name: health
  path: /health
  method: GET
  module: ./handlers/health.ts
  response:
    type: object

- name: items
  path: /items
  method: POST
  module: ./handlers/items.ts
  response:
    type: object
  request:
    type: object
`;

  const contracts = parse(yaml, "yaml");
  assertEquals(contracts.length, 2);
  assertEquals(contracts[0].path, "/health");
  assertEquals(contracts[1].path, "/items");
  assertExists(contracts[1].request);
});

Deno.test("parse: parses TOML contract", () => {
  const toml = `
name = "health"
path = "/health"
method = "GET"
description = "Health check"
module = "./handlers/health.ts"

[response]
type = "object"
`;

  const contracts = parse(toml, "toml");
  assertEquals(contracts.length, 1);
  assertEquals(contracts[0].path, "/health");
  assertEquals(contracts[0].method, "GET");
});

Deno.test("parse: validates required fields", () => {
  const invalidJson = JSON.stringify({ path: "/health" }); // missing name, method, module, response

  assertThrows(() => parse(invalidJson, "json"), Error, "name");
});

Deno.test("parse: validates method values", () => {
  const invalidJson = JSON.stringify({
    name: "health",
    path: "/health",
    method: "INVALID",
    module: "./handler.ts",
    response: { type: "object" },
  });

  assertThrows(() => parse(invalidJson, "json"), Error, "method");
});

Deno.test("load: loads contracts from JSON file", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/contracts.json`;

  const contracts = [
    {
      name: "health",
      path: "/health",
      method: "GET",
      module: "./handlers/health.ts",
      response: { type: "object" },
    },
  ];

  await Deno.writeTextFile(filePath, JSON.stringify(contracts));

  try {
    const loaded = await load(filePath);
    assertEquals(loaded.length, 1);
    assertEquals(loaded[0].path, "/health");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("load: loads contracts from YAML file", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/contracts.yaml`;

  const yaml = `
- name: health
  path: /health
  method: GET
  module: ./handlers/health.ts
  response:
    type: object
`;

  await Deno.writeTextFile(filePath, yaml);

  try {
    const loaded = await load(filePath);
    assertEquals(loaded.length, 1);
    assertEquals(loaded[0].path, "/health");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("load: loads contracts from TOML file", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/contract.toml`;

  const toml = `
name = "health"
path = "/health"
method = "GET"
module = "./handlers/health.ts"

[response]
type = "object"
`;

  await Deno.writeTextFile(filePath, toml);

  try {
    const loaded = await load(filePath);
    assertEquals(loaded.length, 1);
    assertEquals(loaded[0].path, "/health");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// Loader Base Resolution Tests
// ============================================================================

Deno.test("getDefaultBase: returns a file URL", () => {
  const base = getDefaultBase();
  assertEquals(base.startsWith("file://"), true);
  assertEquals(base.endsWith("/"), true);
});

Deno.test("getDefaultBase: returns Deno.mainModule directory", () => {
  const base = getDefaultBase();
  // During `deno test`, Deno.mainModule is the test file itself
  // So getDefaultBase() returns the directory containing this test file
  const mainModuleDir = Deno.mainModule.substring(0, Deno.mainModule.lastIndexOf("/") + 1);

  console.log("Deno.mainModule:", Deno.mainModule);
  console.log("getDefaultBase():", base);
  console.log("Expected mainModuleDir:", mainModuleDir);

  assertEquals(base, mainModuleDir);

  // Verify it points to the orchestrator directory
  assertEquals(base.endsWith("/src/orchestrator/"), true);
});

Deno.test("parse: parses ContractFile with base", () => {
  const json = JSON.stringify({
    base: "./handlers/",
    contracts: [
      {
        name: "health",
        path: "/health",
        method: "GET",
        module: "health.ts",
        response: { type: "object" },
      },
    ],
  });

  const contracts = parse(json, "json");
  assertEquals(contracts.length, 1);
  assertEquals(contracts[0].path, "/health");
});

Deno.test("parse: parses YAML ContractFile with base", () => {
  const yaml = `
base: ./handlers/
contracts:
  - name: health
    path: /health
    method: GET
    module: health.ts
    response:
      type: object
`;

  const contracts = parse(yaml, "yaml");
  assertEquals(contracts.length, 1);
  assertEquals(contracts[0].path, "/health");
});

Deno.test("loadWithBase: returns resolved base from Deno.mainModule when no base specified", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/contracts.json`;

  // Contract file without a base field
  const contracts = [
    {
      name: "health",
      path: "/health",
      method: "GET",
      module: "./handlers/health.ts",
      response: { type: "object" },
    },
  ];

  await Deno.writeTextFile(filePath, JSON.stringify(contracts));

  try {
    const result = await loadWithBase(filePath);
    assertEquals(result.contracts.length, 1);

    // When no base is specified, it should use Deno.mainModule directory
    const expectedBase = getDefaultBase();
    assertEquals(result.base, expectedBase);

    // originalBase should be undefined since we didn't specify one
    assertEquals(result.originalBase, undefined);

    // During tests, this is the orchestrator directory
    assertEquals(result.base.endsWith("/src/orchestrator/"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("loadWithBase: uses base from ContractFile when provided", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/contracts.json`;

  const contractFile = {
    base: "./my-handlers/",
    contracts: [
      {
        name: "health",
        path: "/health",
        method: "GET",
        module: "health.ts",
        response: { type: "object" },
      },
    ],
  };

  await Deno.writeTextFile(filePath, JSON.stringify(contractFile));

  try {
    const result = await loadWithBase(filePath);
    assertEquals(result.contracts.length, 1);
    // Base should be resolved relative to contract file
    assertEquals(result.base.includes("my-handlers"), true);
    assertEquals(result.base.endsWith("/"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("loadWithBase: handles absolute file URL base", async () => {
  const tempDir = await Deno.makeTempDir();
  const filePath = `${tempDir}/contracts.json`;
  const absoluteBase = "file:///absolute/path/to/handlers/";

  const contractFile = {
    base: absoluteBase,
    contracts: [
      {
        name: "health",
        path: "/health",
        method: "GET",
        module: "health.ts",
        response: { type: "object" },
      },
    ],
  };

  await Deno.writeTextFile(filePath, JSON.stringify(contractFile));

  try {
    const result = await loadWithBase(filePath);
    assertEquals(result.base, absoluteBase);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// $include Directive Tests
// ============================================================================

Deno.test("load: resolves $include in JSON", async () => {
  const tempDir = await Deno.makeTempDir();
  const mainFile = `${tempDir}/main.json`;
  const includedFile = `${tempDir}/included.json`;

  const includedContracts = [
    {
      name: "included",
      path: "/included",
      method: "GET",
      module: "./handlers/included.ts",
      response: { type: "object" },
    },
  ];

  const mainContracts = {
    contracts: [
      {
        name: "main",
        path: "/main",
        method: "GET",
        module: "./handlers/main.ts",
        response: { type: "object" },
      },
      { $include: "./included.json" },
    ],
  };

  await Deno.writeTextFile(includedFile, JSON.stringify(includedContracts));
  await Deno.writeTextFile(mainFile, JSON.stringify(mainContracts));

  try {
    const loaded = await load(mainFile);
    assertEquals(loaded.length, 2);
    assertEquals(loaded[0].path, "/main");
    assertEquals(loaded[1].path, "/included");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("load: resolves $include in YAML", async () => {
  const tempDir = await Deno.makeTempDir();
  const mainFile = `${tempDir}/main.yaml`;
  const includedFile = `${tempDir}/included.yaml`;

  const includedYaml = `
- name: included
  path: /included
  method: GET
  module: ./handlers/included.ts
  response:
    type: object
`;

  const mainYaml = `
contracts:
  - name: main
    path: /main
    method: GET
    module: ./handlers/main.ts
    response:
      type: object
  - $include: ./included.yaml
`;

  await Deno.writeTextFile(includedFile, includedYaml);
  await Deno.writeTextFile(mainFile, mainYaml);

  try {
    const loaded = await load(mainFile);
    assertEquals(loaded.length, 2);
    assertEquals(loaded[0].path, "/main");
    assertEquals(loaded[1].path, "/included");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("load: resolves nested $include", async () => {
  const tempDir = await Deno.makeTempDir();
  const mainFile = `${tempDir}/main.json`;
  const level1File = `${tempDir}/level1.json`;
  const level2File = `${tempDir}/level2.json`;

  const level2Contracts = [
    {
      name: "level2",
      path: "/level2",
      method: "GET",
      module: "./handlers/level2.ts",
      response: { type: "object" },
    },
  ];

  const level1Contracts = [
    {
      name: "level1",
      path: "/level1",
      method: "GET",
      module: "./handlers/level1.ts",
      response: { type: "object" },
    },
    { $include: "./level2.json" },
  ];

  const mainContracts = [
    {
      name: "main",
      path: "/main",
      method: "GET",
      module: "./handlers/main.ts",
      response: { type: "object" },
    },
    { $include: "./level1.json" },
  ];

  await Deno.writeTextFile(level2File, JSON.stringify(level2Contracts));
  await Deno.writeTextFile(level1File, JSON.stringify(level1Contracts));
  await Deno.writeTextFile(mainFile, JSON.stringify(mainContracts));

  try {
    const loaded = await load(mainFile);
    assertEquals(loaded.length, 3);
    assertEquals(loaded[0].path, "/main");
    assertEquals(loaded[1].path, "/level1");
    assertEquals(loaded[2].path, "/level2");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("load: detects circular $include", async () => {
  const tempDir = await Deno.makeTempDir();
  const fileA = `${tempDir}/a.json`;
  const fileB = `${tempDir}/b.json`;

  const contractsA = [{ $include: "./b.json" }];
  const contractsB = [{ $include: "./a.json" }];

  await Deno.writeTextFile(fileA, JSON.stringify(contractsA));
  await Deno.writeTextFile(fileB, JSON.stringify(contractsB));

  try {
    await load(fileA);
    throw new Error("Should have thrown circular include error");
  } catch (e) {
    assertEquals((e as Error).message.includes("Circular include"), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("loadSync: resolves $include synchronously", () => {
  const tempDir = Deno.makeTempDirSync();
  const mainFile = `${tempDir}/main.json`;
  const includedFile = `${tempDir}/included.json`;

  const includedContracts = [
    {
      name: "included",
      path: "/included",
      method: "GET",
      module: "./handlers/included.ts",
      response: { type: "object" },
    },
  ];

  const mainContracts = [
    {
      name: "main",
      path: "/main",
      method: "GET",
      module: "./handlers/main.ts",
      response: { type: "object" },
    },
    { $include: "./included.json" },
  ];

  Deno.writeTextFileSync(includedFile, JSON.stringify(includedContracts));
  Deno.writeTextFileSync(mainFile, JSON.stringify(mainContracts));

  try {
    const loaded = loadSync(mainFile);
    assertEquals(loaded.length, 2);
    assertEquals(loaded[0].path, "/main");
    assertEquals(loaded[1].path, "/included");
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

// ============================================================================
// Transpile Tests
// ============================================================================

Deno.test("getDefaultOutputPath: replaces extension with json", () => {
  assertEquals(getDefaultOutputPath("contracts.yaml"), "contracts.json");
  assertEquals(getDefaultOutputPath("contracts.yml"), "contracts.json");
  assertEquals(getDefaultOutputPath("contracts.toml"), "contracts.json");
  assertEquals(getDefaultOutputPath("path/to/contracts.yaml"), "path/to/contracts.json");
});

Deno.test("transpile: converts YAML to JSON", async () => {
  const tempDir = await Deno.makeTempDir();
  const sourceFile = `${tempDir}/contracts.yaml`;
  const outputFile = `${tempDir}/contracts.json`;

  const yaml = `
base: ./handlers/
contracts:
  - name: health
    path: /health
    method: GET
    module: health.ts
    response:
      type: object
`;

  await Deno.writeTextFile(sourceFile, yaml);

  try {
    const result = await transpile(sourceFile, { output: outputFile });

    assertEquals(result.contracts.contracts.length, 1);
    assertEquals(result.contracts.contracts[0].path, "/health");
    assertEquals(result.outputPath, outputFile);

    // Verify the output file was written
    const outputContent = await Deno.readTextFile(outputFile);
    const parsed = JSON.parse(outputContent);
    assertEquals(parsed.contracts.length, 1);
    assertEquals(parsed.contracts[0].path, "/health");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("transpile: resolves includes before output", async () => {
  const tempDir = await Deno.makeTempDir();
  const mainFile = `${tempDir}/main.yaml`;
  const includedFile = `${tempDir}/included.yaml`;
  const outputFile = `${tempDir}/output.json`;

  const includedYaml = `
- name: included
  path: /included
  method: GET
  module: included.ts
  response:
    type: object
`;

  const mainYaml = `
contracts:
  - name: main
    path: /main
    method: GET
    module: main.ts
    response:
      type: object
  - $include: ./included.yaml
`;

  await Deno.writeTextFile(includedFile, includedYaml);
  await Deno.writeTextFile(mainFile, mainYaml);

  try {
    const result = await transpile(mainFile, { output: outputFile });

    // Both contracts should be in the result
    assertEquals(result.contracts.contracts.length, 2);

    // Verify output file has flattened contracts
    const outputContent = await Deno.readTextFile(outputFile);
    const parsed = JSON.parse(outputContent);
    assertEquals(parsed.contracts.length, 2);
    assertEquals(parsed.contracts[0].path, "/main");
    assertEquals(parsed.contracts[1].path, "/included");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("transpileSync: works synchronously", () => {
  const tempDir = Deno.makeTempDirSync();
  const sourceFile = `${tempDir}/contracts.json`;
  const outputFile = `${tempDir}/output.json`;

  const contracts = {
    base: "./handlers/",
    contracts: [
      {
        name: "health",
        path: "/health",
        method: "GET",
        module: "health.ts",
        response: { type: "object" },
      },
    ],
  };

  Deno.writeTextFileSync(sourceFile, JSON.stringify(contracts));

  try {
    const result = transpileSync(sourceFile, { output: outputFile });

    assertEquals(result.contracts.contracts.length, 1);
    assertEquals(result.outputPath, outputFile);

    // Verify output
    const outputContent = Deno.readTextFileSync(outputFile);
    const parsed = JSON.parse(outputContent);
    assertEquals(parsed.contracts.length, 1);
  } finally {
    Deno.removeSync(tempDir, { recursive: true });
  }
});

Deno.test("transpile: pretty option controls formatting", async () => {
  const tempDir = await Deno.makeTempDir();
  const sourceFile = `${tempDir}/contracts.json`;

  const contracts = {
    contracts: [
      {
        name: "health",
        path: "/health",
        method: "GET",
        module: "health.ts",
        response: { type: "object" },
      },
    ],
  };

  await Deno.writeTextFile(sourceFile, JSON.stringify(contracts));

  try {
    const prettyResult = await transpile(sourceFile, { pretty: true });
    const compactResult = await transpile(sourceFile, { pretty: false });

    // Pretty should have newlines
    assertEquals(prettyResult.json.includes("\n"), true);
    // Compact should not have newlines
    assertEquals(compactResult.json.includes("\n"), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("transpile: generates TypeScript with format='ts'", async () => {
  const tempDir = await Deno.makeTempDir();
  const sourceFile = `${tempDir}/contracts.yaml`;
  const outputFile = `${tempDir}/contracts.ts`;

  const yaml = `
contracts:
  - name: health
    path: /health
    method: GET
    module: health.ts
    response:
      type: object
      properties:
        status:
          type: string
      required:
        - status
`;

  await Deno.writeTextFile(sourceFile, yaml);

  try {
    const result = await transpile(sourceFile, { output: outputFile, format: "ts" });

    // Should contain TypeScript-specific content
    assertEquals(result.content.includes("as const"), true);
    assertEquals(result.content.includes("export const contracts"), true);
    assertEquals(result.content.includes("export type Contracts"), true);
    assertEquals(result.content.includes("FromSchema"), true); // Usage hint in comment

    // Should contain the contract data
    assertEquals(result.content.includes('"/health"'), true);
    assertEquals(result.content.includes('"GET"'), true);

    // Verify output file
    const outputContent = await Deno.readTextFile(outputFile);
    assertEquals(outputContent, result.content);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("getDefaultOutputPath: respects format parameter", () => {
  assertEquals(getDefaultOutputPath("contracts.yaml", "json"), "contracts.json");
  assertEquals(getDefaultOutputPath("contracts.yaml", "ts"), "contracts.ts");
  assertEquals(getDefaultOutputPath("path/to/contracts.toml", "ts"), "path/to/contracts.ts");
});

Deno.test("transpile: generated TypeScript passes type checking", async () => {
  const tempDir = await Deno.makeTempDir();
  const sourceFile = `${tempDir}/contracts.yaml`;
  const contractsFile = `${tempDir}/contracts.ts`;
  const testFile = `${tempDir}/type_test.ts`;
  const denoJsonFile = `${tempDir}/deno.json`;

  // Create a contract with a specific response schema
  const yaml = `
contracts:
  - name: health
    path: /health
    method: GET
    module: health.ts
    response:
      type: object
      properties:
        status:
          type: string
          const: ok
        uptime:
          type: number
      required:
        - status
        - uptime
      additionalProperties: false
`;

  await Deno.writeTextFile(sourceFile, yaml);

  // Create a deno.json with the necessary import
  const denoJson = {
    imports: {
      "json-schema-to-ts": "npm:json-schema-to-ts@^3.1.1",
    },
  };
  await Deno.writeTextFile(denoJsonFile, JSON.stringify(denoJson, null, 2));

  // Create client directory with mock utility.ts for the generated import
  // The generated import is "../client/utility.ts" relative to contracts.ts,
  // so client/ needs to be a sibling of the temp directory
  const parentDir = tempDir.substring(0, tempDir.lastIndexOf("/") > 0 ? tempDir.lastIndexOf("/") : tempDir.lastIndexOf("\\"));
  const clientDir = `${parentDir}/client`;
  await Deno.mkdir(clientDir, { recursive: true });
  const utilityCode = `
// Mock utility types for type checking test
export type ContractByName<T extends readonly unknown[], N extends string> =
  Extract<T[number], { name: N }>;

// Mock create function for miniclient factory
export function create(_contract: unknown) {
  return () => {};
}
`;
  await Deno.writeTextFile(`${clientDir}/utility.ts`, utilityCode);

  try {
    // Transpile to TypeScript
    await transpile(sourceFile, { output: contractsFile, format: "ts" });

    // Create a test file that uses the generated types with FromSchema
    const testCode = `
import { FromSchema } from "json-schema-to-ts";
import { contracts } from "./contracts.ts";

// Extract the response schema type from the first contract
type HealthResponse = FromSchema<typeof contracts[0]["response"]>;

// This should compile: correct shape
const validResponse: HealthResponse = {
  status: "ok",
  uptime: 12345,
};

// Type-level test: verify the inferred type has the expected properties
type AssertHasStatus = HealthResponse extends { status: "ok" } ? true : false;
type AssertHasUptime = HealthResponse extends { uptime: number } ? true : false;
const _checkStatus: AssertHasStatus = true;
const _checkUptime: AssertHasUptime = true;

// Export to prevent unused variable warnings
export { validResponse };
`;

    await Deno.writeTextFile(testFile, testCode);

    // Run deno check to verify types
    const cmd = new Deno.Command("deno", {
      args: ["check", testFile],
      cwd: tempDir,
    });
    const { code, stderr } = await cmd.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`Type checking failed: ${errorText}`);
    }

    assertEquals(code, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
    // Clean up client directory in parent temp folder
    try {
      await Deno.remove(clientDir, { recursive: true });
    } catch {
      // Ignore if already removed
    }
  }
});

Deno.test("transpile: generated contracts work with client utility", async () => {
  const tempDir = await Deno.makeTempDir();
  const sourceFile = `${tempDir}/contracts.yaml`;
  const contractsFile = `${tempDir}/contracts.ts`;
  const handlerFile = `${tempDir}/handler.ts`;

  // Create a contract
  const yaml = `
contracts:
  - name: echo
    path: /echo
    method: POST
    module: ./handler.ts
    description: Echo back the input
    request:
      type: object
      properties:
        message:
          type: string
      required:
        - message
    response:
      type: object
      properties:
        echo:
          type: string
        timestamp:
          type: number
      required:
        - echo
        - timestamp
`;

  // Create a handler module
  const handlerCode = `
export default (input: { message: string }) => ({
  echo: input.message,
  timestamp: Date.now(),
});
`;

  await Deno.writeTextFile(sourceFile, yaml);
  await Deno.writeTextFile(handlerFile, handlerCode);

  try {
    // Transpile to TypeScript
    const result = await transpile(sourceFile, { output: contractsFile, format: "ts" });
    assertEquals(result.contracts.contracts.length, 1);

    // Build a server from the transpiled contracts
    const contract = result.contracts.contracts[0];
    // Override the module path to use the handler we created
    const contractWithHandler = {
      ...contract,
      module: toFileUrl(handlerFile).href,
    };

    const app = await buildRoutes([contractWithHandler]);

    // Start the server
    const controller = new AbortController();
    const server = Deno.serve(
      { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
      app.fetch
    );

    try {
      // Create a client utility from the same contract
      const echoRequest = createClientUtility(contractWithHandler);
      const client = new Client(TEST_URL);

      // Make a request
      const response = await echoRequest(client, { message: "Hello, typed world!" }) as {
        echo: string;
        timestamp: number;
      };

      // Verify the response matches the contract schema
      assertEquals(response.echo, "Hello, typed world!");
      assertEquals(typeof response.timestamp, "number");
    } finally {
      controller.abort();
      await server.finished;
    }
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

// ============================================================================
// Regression Tests
// ============================================================================

Deno.test("Client: DELETE returns response body when present", async () => {
  // Regression test: DELETE requests can have response bodies
  // Previously, DELETE was incorrectly grouped with HEAD to return undefined
  const controller = new AbortController();
  const server = Deno.serve(
    { port: TEST_PORT, signal: controller.signal, onListen: () => {} },
    () => new Response(JSON.stringify({ deleted: true, id: "123" }), {
      headers: { "Content-Type": "application/json" },
    })
  );

  try {
    const client = new Client(TEST_URL);
    const result = await client.simple("DELETE", "resource/123");
    assertEquals(result, { deleted: true, id: "123" });
  } finally {
    controller.abort();
    await server.finished;
  }
});

// ============================================================================
// Type Utility Tests
// ============================================================================

Deno.test("ContractByName: extracts correct contract type by name", () => {
  // This test verifies that ContractByName correctly extracts a contract by its name
  // using TypeScript's type filtering capabilities

  // Extract the target:info contract type
  type TargetInfoContract = ContractByName<typeof contracts, "target:info">;

  // Find the contract at runtime
  const targetInfoContract = contracts.find(
    (c): c is TargetInfoContract => c.name === "target:info"
  )!;

  // Verify the contract has the expected properties
  assertEquals(targetInfoContract.name, "target:info");
  assertEquals(targetInfoContract.path, "/:endpoint/:context/:target");
  assertEquals(targetInfoContract.method, "GET");

  // Verify the response schema is present and has expected properties
  assertExists(targetInfoContract.response);
  assertEquals(targetInfoContract.response.type, "object");

  // Type-level verification: The extracted type should have the correct shape
  // This is a compile-time check - if ContractByName doesn't work, this won't compile
  const _nameCheck: TargetInfoContract["name"] = "target:info";
  const _methodCheck: TargetInfoContract["method"] = "GET";

  // Verify we can use FromSchema with the extracted contract's schemas
  type TargetInfoResponse = FromSchema<TargetInfoContract["response"]>;

  // Type assertion: The response type should have the expected properties
  // This validates that the full type chain works: contracts -> ContractByName -> FromSchema
  const _responseShapeCheck: TargetInfoResponse = {
    id: "test-id",
    type: "page",
    title: "Test Page",
    url: "https://example.com",
  };

  // Verify the shape at runtime too
  assertExists(_responseShapeCheck.id);
  assertExists(_responseShapeCheck.type);
  assertExists(_responseShapeCheck.title);
  assertExists(_responseShapeCheck.url);
});
