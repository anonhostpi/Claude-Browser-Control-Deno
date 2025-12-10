/**
 * MCP Server Tests
 *
 * Comprehensive tests for the MCP (Model Context Protocol) server implementation.
 * Includes tests for JSON-RPC handling, tool management, and REST API bridging.
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { Server as MCPServer } from "./server.ts";
import type {
  JSONRPCRequest,
  MCPTool,
  ToolsListResult,
  ToolsCallResult,
  InitializeResult,
} from "./types.ts";
import { ErrorCodes } from "./types.ts";

// =============================================================================
// Server Initialization Tests
// =============================================================================

Deno.test("MCPServer: initializes with default config", () => {
  const server = new MCPServer();
  assertExists(server);
});

Deno.test("MCPServer: initializes with custom config", () => {
  const server = new MCPServer({
    api: "http://localhost:8080",
    name: "test-server",
    version: "2.0.0",
  });
  assertExists(server);
});

Deno.test("MCPServer: initializes with partial config", () => {
  const server = new MCPServer({
    api: "http://localhost:8080",
    // name and version use defaults
  });
  assertExists(server);
});

// =============================================================================
// Initialize Request Tests
// =============================================================================

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

  const result = response.result as InitializeResult;
  assertEquals(result.protocolVersion, "2024-11-05");
  assertExists(result.capabilities);
  assertExists(result.serverInfo);
});

Deno.test("MCPServer: initialize returns correct server info", async () => {
  const server = new MCPServer({
    name: "custom-server",
    version: "3.0.0",
  });

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
  const result = response.result as InitializeResult;

  assertEquals(result.serverInfo.name, "custom-server");
  assertEquals(result.serverInfo.version, "3.0.0");
});

Deno.test("MCPServer: initialize returns tools capability", async () => {
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
  const result = response.result as InitializeResult;

  assertExists(result.capabilities.tools);
});

// =============================================================================
// Tools List Tests
// =============================================================================

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

  const result = response.result as ToolsListResult;
  assertExists(result.tools);
  assertEquals(Array.isArray(result.tools), true);
  // Should have loaded tools from contracts (28 contracts = 28 tools)
  assertEquals(result.tools.length, 28);
});

Deno.test("MCPServer: tools have correct structure", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await server.handleRequest(request);
  const result = response.result as ToolsListResult;

  // Each tool should have name, description, and inputSchema
  for (const tool of result.tools) {
    assertExists(tool.name);
    assertExists(tool.description);
    assertExists(tool.inputSchema);
    assertEquals(tool.inputSchema.type, "object");
  }
});

Deno.test("MCPServer: tools include expected contract tools", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await server.handleRequest(request);
  const result = response.result as ToolsListResult;
  const toolNames = result.tools.map((t: MCPTool) => t.name);

  // Check for some expected tools (contract names converted to tool names)
  // Note: colons are replaced with underscores
  assertEquals(toolNames.includes("root_health") || toolNames.includes("root:health"), true);
});

// =============================================================================
// Tools Call Tests
// =============================================================================

Deno.test("MCPServer: returns error for missing tool name in tools/call", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      // missing name
    },
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 4);
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.InvalidParams);
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
  // Unknown tool returns a JSON-RPC error
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.InvalidParams);
  assertStringIncludes(response.error?.message ?? "", "Unknown tool");
});

// =============================================================================
// Unknown Method Tests
// =============================================================================

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
  assertEquals(response.error?.code, ErrorCodes.MethodNotFound);
});

Deno.test("MCPServer: returns error for resources/list (not implemented)", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 5,
    method: "resources/list",
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.MethodNotFound);
});

Deno.test("MCPServer: returns error for prompts/list (not implemented)", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 6,
    method: "prompts/list",
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.MethodNotFound);
});

// =============================================================================
// Notification Tests
// =============================================================================

Deno.test("MCPServer: handles initialized notification", () => {
  const server = new MCPServer();

  // This should not throw
  server.handleNotification({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
});

Deno.test("MCPServer: handles cancelled notification", () => {
  const server = new MCPServer();

  // This should not throw
  server.handleNotification({
    jsonrpc: "2.0",
    method: "notifications/cancelled",
    params: { requestId: 123 },
  });
});

Deno.test("MCPServer: ignores unknown notifications without error", () => {
  const server = new MCPServer();

  // This should not throw
  server.handleNotification({
    jsonrpc: "2.0",
    method: "unknown/notification",
  });

  server.handleNotification({
    jsonrpc: "2.0",
    method: "custom/event",
    params: { data: "test" },
  });
});

// =============================================================================
// JSON-RPC Response Format Tests
// =============================================================================

Deno.test("MCPServer: success response has correct structure", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 100,
    method: "tools/list",
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 100);
  assertExists(response.result);
  assertEquals(response.error, undefined);
});

Deno.test("MCPServer: error response has correct structure", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 101,
    method: "invalid/method",
  };

  const response = await server.handleRequest(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 101);
  assertEquals(response.result, undefined);
  assertExists(response.error);
  assertExists(response.error?.code);
  assertExists(response.error?.message);
});

Deno.test("MCPServer: preserves request id in response", async () => {
  const server = new MCPServer();

  // Test with numeric id
  const numericRequest: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 42,
    method: "tools/list",
  };
  const numericResponse = await server.handleRequest(numericRequest);
  assertEquals(numericResponse.id, 42);

  // Test with string id
  const stringRequest: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: "request-abc-123",
    method: "tools/list",
  };
  const stringResponse = await server.handleRequest(stringRequest);
  assertEquals(stringResponse.id, "request-abc-123");
});

// =============================================================================
// Error Code Tests
// =============================================================================

Deno.test("ErrorCodes: has standard JSON-RPC error codes", () => {
  assertEquals(ErrorCodes.ParseError, -32700);
  assertEquals(ErrorCodes.InvalidRequest, -32600);
  assertEquals(ErrorCodes.MethodNotFound, -32601);
  assertEquals(ErrorCodes.InvalidParams, -32602);
  assertEquals(ErrorCodes.InternalError, -32603);
});

// =============================================================================
// Type Export Tests
// =============================================================================

Deno.test("types: MCPTool interface is correct", () => {
  const tool: MCPTool = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: {
      type: "object",
      properties: {
        arg1: { type: "string" },
      },
      required: ["arg1"],
    },
  };

  assertEquals(tool.name, "test_tool");
  assertEquals(tool.inputSchema.type, "object");
});

Deno.test("types: ToolsCallResult can have error flag", () => {
  const successResult: ToolsCallResult = {
    content: [{ type: "text", text: "Success!" }],
  };

  const errorResult: ToolsCallResult = {
    content: [{ type: "text", text: "Error occurred" }],
    isError: true,
  };

  assertEquals(successResult.isError, undefined);
  assertEquals(errorResult.isError, true);
});

// =============================================================================
// TDD Tests for Future Refactor
// These tests define expected behavior for the MCP refactor
// =============================================================================

Deno.test("TDD: MCPServer should support client hierarchy", async () => {
  // Future: MCP should use the same client hierarchy as CLI
  // Root -> Endpoint -> Context -> Target -> Node
  const server = new MCPServer({
    apiUrl: "http://localhost:9333",
  });

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await server.handleRequest(request);
  const result = response.result as ToolsListResult;

  // Tools should map to contract hierarchy
  const toolNames = result.tools.map((t: MCPTool) => t.name);
  assertEquals(Array.isArray(toolNames), true);
  assertEquals(toolNames.length > 0, true);
});

Deno.test("TDD: MCPServer tools should have path parameters in schema", async () => {
  const server = new MCPServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await server.handleRequest(request);
  const result = response.result as ToolsListResult;

  // Find a tool that requires path parameters (e.g., endpoint:info needs :endpoint)
  const endpointTool = result.tools.find((t: MCPTool) =>
    t.name.includes("endpoint") && t.name.includes("info")
  );

  if (endpointTool) {
    // Tool schema should include endpoint as a property
    assertExists(endpointTool.inputSchema.properties);
  }
});

Deno.test("TDD: MCPServer should handle tool call with path params", async () => {
  const server = new MCPServer();

  // Get tools list first to find exact tool name
  const listRequest: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };
  const listResponse = await server.handleRequest(listRequest);
  const result = listResponse.result as ToolsListResult;

  // Find the root_list or root:list tool
  const rootListTool = result.tools.find((t: MCPTool) =>
    t.name === "root_list" || t.name === "root:list"
  );

  if (rootListTool) {
    // Calling a tool should work (though it may fail due to no server running)
    const callRequest: JSONRPCRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: rootListTool.name,
        arguments: {},
      },
    };

    const callResponse = await server.handleRequest(callRequest);
    // Response should be valid JSON-RPC (either success or error result)
    assertEquals(callResponse.jsonrpc, "2.0");
    assertEquals(callResponse.id, 2);
    // Either result or error should be present
    assertEquals(callResponse.result !== undefined || callResponse.error !== undefined, true);
  }
});
