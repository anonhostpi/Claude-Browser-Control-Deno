/**
 * MCP Server tests.
 */

import { assertEquals, assertExists } from "@std/assert";
import { MCPServer } from "./server.ts";
import type { JSONRPCRequest } from "./types.ts";

Deno.test("MCPServer: initializes with default config", () => {
  const server = new MCPServer();
  assertExists(server);
});

Deno.test("MCPServer: initializes with custom config", () => {
  const server = new MCPServer({
    apiUrl: "http://localhost:8080",
    name: "test-server",
    version: "2.0.0",
  });
  assertExists(server);
});

Deno.test("MCPServer: handles initialize request", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 1);
  assertExists(response.result);
  assertEquals((response.result as Record<string, unknown>).protocolVersion, "2024-11-05");
});

Deno.test("MCPServer: handles tools/list request", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 2);
  assertExists(response.result);

  const result = response.result as { tools: unknown[] };
  assertExists(result.tools);
  // Should have loaded tools from contracts (28 contracts = 28 tools)
  assertEquals(Array.isArray(result.tools), true);
  assertEquals(result.tools.length, 28);
});

Deno.test("MCPServer: returns error for unknown method", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "unknown/method",
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 3);
  assertExists(response.error);
  assertEquals(response.error?.code, -32601); // MethodNotFound
});

Deno.test("MCPServer: returns error for unknown tool in tools/call", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "nonexistent_tool",
    },
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 4);
  // Should return a result with isError: true, not a JSON-RPC error
  const result = response.result as { isError?: boolean };
  // Unknown tool returns in a tool result with error
  assertExists(response.error || result?.isError);
});

Deno.test("MCPServer: handles notification without response", () => {
  const server = new MCPServer();

  // This should not throw
  server.handleNotification({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  // Unknown notification should also not throw
  server.handleNotification({
    jsonrpc: "2.0",
    method: "unknown/notification",
  });
});
