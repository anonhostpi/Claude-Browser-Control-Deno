/**
 * Client Tests
 *
 * Tests for the hierarchical client architecture:
 * Root -> Endpoint -> Context -> Target -> Node
 *
 * These tests focus on client construction, URL building, and method signatures.
 * Integration tests that actually call the server are separate.
 */

import { assertEquals, assertExists, assertInstanceOf } from "@std/assert";
import { Root } from "./root.ts";
import { Endpoint } from "./endpoint.ts";
import { Context } from "./context.ts";
import { Target } from "./target.ts";
import { Node } from "./node.ts";
import { Client, ResponseError } from "../orchestrator/client/client.ts";

// =============================================================================
// Client Base Class Tests
// =============================================================================

Deno.test("Client: constructs with URL string", () => {
  const client = new Client("http://localhost:9333");
  assertEquals(client.url, "http://localhost:9333");
});

Deno.test("Client: constructs with parent and path", () => {
  const parent = new Client("http://localhost:9333");
  const child = new Client(parent, "endpoint");
  assertEquals(child.url, "http://localhost:9333/endpoint");
});

Deno.test("Client: builds nested URLs correctly", () => {
  const root = new Client("http://localhost:9333");
  const endpoint = new Client(root, "chrome");
  const context = new Client(endpoint, "Agent");
  const target = new Client(context, "target-123");

  assertEquals(root.url, "http://localhost:9333");
  assertEquals(endpoint.url, "http://localhost:9333/chrome");
  assertEquals(context.url, "http://localhost:9333/chrome/Agent");
  assertEquals(target.url, "http://localhost:9333/chrome/Agent/target-123");
});

Deno.test("Client: handles trailing slashes in parent URL", () => {
  const parent = new Client("http://localhost:9333/");
  const child = new Client(parent, "endpoint");
  assertEquals(child.url, "http://localhost:9333/endpoint");
});

Deno.test("Client: parent getter returns parent URL", () => {
  const parent = new Client("http://localhost:9333");
  const child = new Client(parent, "endpoint");
  assertEquals(child.parent, "http://localhost:9333");
});

Deno.test("Client: path getter returns relative path", () => {
  const root = new Client("http://localhost:9333");
  const endpoint = new Client(root, "chrome");
  const context = new Client(endpoint, "Agent");

  assertEquals(root.path, "");
  assertEquals(endpoint.path, "chrome");
  assertEquals(context.path, "chrome/Agent");
});

Deno.test("ResponseError: has status and message", () => {
  const error = new ResponseError("Not Found", 404);
  assertEquals(error.message, "Not Found");
  assertEquals(error.status, 404);
  assertInstanceOf(error, Error);
});

// =============================================================================
// Root Client Tests
// =============================================================================

Deno.test("Root: constructs with server URL", () => {
  const root = new Root("http://localhost:9333");
  assertEquals(root.url, "http://localhost:9333");
});

Deno.test("Root: implements IRootClient interface", () => {
  const root = new Root("http://localhost:9333");

  // Verify method signatures exist
  assertExists(root.health);
  assertExists(root.list);
  assertExists(root.killAll);
  assertExists(root.endpoint);
});

Deno.test("Root: endpoint() returns Endpoint instance", async () => {
  const root = new Root("http://localhost:9333");
  const endpoint = await root.endpoint("chrome");

  assertInstanceOf(endpoint, Endpoint);
  assertEquals(endpoint.url, "http://localhost:9333/chrome");
});

// =============================================================================
// Endpoint Client Tests
// =============================================================================

Deno.test("Endpoint: constructs with root and name", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");

  assertEquals(endpoint.url, "http://localhost:9333/chrome");
});

Deno.test("Endpoint: implements IEndpointClient interface", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");

  assertExists(endpoint.exists);
  assertExists(endpoint.info);
  assertExists(endpoint.launch);
  assertExists(endpoint.killAll);
  assertExists(endpoint.context);
});

Deno.test("Endpoint: different browser types produce different URLs", () => {
  const root = new Root("http://localhost:9333");

  const chrome = new Endpoint(root, "chrome");
  const edge = new Endpoint(root, "edge");
  const brave = new Endpoint(root, "brave");

  assertEquals(chrome.url, "http://localhost:9333/chrome");
  assertEquals(edge.url, "http://localhost:9333/edge");
  assertEquals(brave.url, "http://localhost:9333/brave");
});

// =============================================================================
// Context Client Tests
// =============================================================================

Deno.test("Context: constructs with endpoint and id", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");

  assertEquals(context.url, "http://localhost:9333/chrome/Agent");
});

Deno.test("Context: implements IContextClient interface", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");

  assertExists(context.create);
  assertExists(context.exists);
  assertExists(context.info);
  assertExists(context.close);
  assertExists(context.target);
});

Deno.test("Context: target() returns Target instance", async () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = await context.target("target-123");

  assertInstanceOf(target, Target);
  assertEquals(target.url, "http://localhost:9333/chrome/Agent/target-123");
});

// =============================================================================
// Target Client Tests
// =============================================================================

Deno.test("Target: constructs with context and id", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = new Target(context, "target-123");

  assertEquals(target.url, "http://localhost:9333/chrome/Agent/target-123");
});

Deno.test("Target: implements ITargetClient interface", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = new Target(context, "target-123");

  assertExists(target.exists);
  assertExists(target.info);
  assertExists(target.cdp);
  assertExists(target.control);
  assertExists(target.create);
  assertExists(target.content);
  assertExists(target.emulate);
  assertExists(target.throttle);
  assertExists(target.intercept);
  assertExists(target.label);
  assertExists(target.close);
  assertExists(target.node);
});

Deno.test("Target: node() returns Node instance", async () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = new Target(context, "target-123");
  const node = await target.node(456);

  assertInstanceOf(node, Node);
  assertEquals(node.url, "http://localhost:9333/chrome/Agent/target-123/456");
});

// =============================================================================
// Node Client Tests
// =============================================================================

Deno.test("Node: constructs with target and numeric id", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = new Target(context, "target-123");
  const node = new Node(target, 456);

  assertEquals(node.url, "http://localhost:9333/chrome/Agent/target-123/456");
});

Deno.test("Node: implements INodeClient interface", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = new Target(context, "target-123");
  const node = new Node(target, 456);

  assertExists(node.exists);
  assertExists(node.info);
  assertExists(node.replace);
  assertExists(node.interact);
  assertExists(node.remove);
  assertExists(node.create);
});

Deno.test("Node: converts numeric id to string for URL", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = new Target(context, "target-123");

  const node1 = new Node(target, 1);
  const node2 = new Node(target, 999);

  assertEquals(node1.url, "http://localhost:9333/chrome/Agent/target-123/1");
  assertEquals(node2.url, "http://localhost:9333/chrome/Agent/target-123/999");
});

// =============================================================================
// Full Hierarchy Tests
// =============================================================================

Deno.test("Client hierarchy: full path from root to node", async () => {
  const root = new Root("http://localhost:9333");
  const endpoint = await root.endpoint("chrome");
  // Note: context() tries to create/verify, so we use constructor directly
  const context = new Context(endpoint, "Agent");
  const target = await context.target("page-1");
  const node = await target.node(42);

  assertEquals(root.url, "http://localhost:9333");
  assertEquals(endpoint.url, "http://localhost:9333/chrome");
  assertEquals(context.url, "http://localhost:9333/chrome/Agent");
  assertEquals(target.url, "http://localhost:9333/chrome/Agent/page-1");
  assertEquals(node.url, "http://localhost:9333/chrome/Agent/page-1/42");
});

Deno.test("Client hierarchy: different endpoints share same root", async () => {
  const root = new Root("http://localhost:9333");

  const chrome = await root.endpoint("chrome");
  const edge = await root.endpoint("edge");

  // Both should have same parent URL
  assertEquals(chrome.parent, "http://localhost:9333");
  assertEquals(edge.parent, "http://localhost:9333");
});

Deno.test("Client hierarchy: path builds correctly through chain", () => {
  const root = new Root("http://localhost:9333");
  const endpoint = new Endpoint(root, "chrome");
  const context = new Context(endpoint, "Agent");
  const target = new Target(context, "page-1");
  const node = new Node(target, 42);

  assertEquals(root.path, "");
  assertEquals(endpoint.path, "chrome");
  assertEquals(context.path, "chrome/Agent");
  assertEquals(target.path, "chrome/Agent/page-1");
  assertEquals(node.path, "chrome/Agent/page-1/42");
});

// =============================================================================
// Type Export Tests
// =============================================================================

Deno.test("exports: all client classes are exported from mod.ts", async () => {
  const mod = await import("./mod.ts");

  assertExists(mod.Root);
  assertExists(mod.Endpoint);
  assertExists(mod.Context);
  assertExists(mod.Target);
  assertExists(mod.Node);
});

Deno.test("exports: Client base class is exported from orchestrator", async () => {
  const mod = await import("../orchestrator/client/mod.ts");

  assertExists(mod.Client);
});
