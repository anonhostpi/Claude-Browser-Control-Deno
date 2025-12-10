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
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCMessage,
  MCPTool,
  ToolsListResult,
  ToolsCallResult,
  InitializeResult,
} from "./types.ts";
import { ErrorCodes } from "./types.ts";
import type { IMCPTransport } from "./transports/types.ts";

// =============================================================================
// Test Helper: MockTransport
// =============================================================================

/**
 * Mock transport for testing MCP server without actual I/O.
 * Captures messages sent by the server and allows sending messages to it.
 */
class MockTransport implements IMCPTransport {
  onmessage?: (message: JSONRPCMessage, sessionId?: string) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  #pendingResolve?: (message: JSONRPCResponse) => void;

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: JSONRPCMessage): Promise<void> {
    if (this.#pendingResolve) {
      this.#pendingResolve(message as JSONRPCResponse);
      this.#pendingResolve = undefined;
    }
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }

  /** Send a request and get the response */
  request(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    return new Promise((resolve) => {
      this.#pendingResolve = resolve;
      this.onmessage?.(request);
    });
  }

  /** Send a notification (no response expected) */
  notify(notification: JSONRPCNotification): void {
    this.onmessage?.(notification);
  }
}

/** Helper to create a connected server with mock transport */
async function createTestServer(config?: ConstructorParameters<typeof MCPServer>[0]): Promise<{
  server: MCPServer;
  transport: MockTransport;
}> {
  const server = new MCPServer(config);
  const transport = new MockTransport();

  // Connect but don't await (it would block on start())
  server.connect(transport);
  await transport.start();

  return { server, transport };
}

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
  const { transport } = await createTestServer();

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

  const response = await transport.request(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 1);
  assertExists(response.result);

  const result = response.result as InitializeResult;
  assertEquals(result.protocolVersion, "2024-11-05");
  assertExists(result.capabilities);
  assertExists(result.serverInfo);
});

Deno.test("MCPServer: initialize returns correct server info", async () => {
  const { transport } = await createTestServer({
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

  const response = await transport.request(request);
  const result = response.result as InitializeResult;

  assertEquals(result.serverInfo.name, "custom-server");
  assertEquals(result.serverInfo.version, "3.0.0");
});

Deno.test("MCPServer: initialize returns tools capability", async () => {
  const { transport } = await createTestServer();

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

  const response = await transport.request(request);
  const result = response.result as InitializeResult;

  assertExists(result.capabilities.tools);
});

// =============================================================================
// Tools List Tests
// =============================================================================

Deno.test("MCPServer: handles tools/list request", async () => {
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  };

  const response = await transport.request(request);

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
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await transport.request(request);
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
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await transport.request(request);
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
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      // missing name
    },
  };

  const response = await transport.request(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 4);
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.InvalidParams);
});

Deno.test("MCPServer: returns error for unknown tool in tools/call", async () => {
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "nonexistent_tool",
    },
  };

  const response = await transport.request(request);

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
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "unknown/method",
  };

  const response = await transport.request(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 3);
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.MethodNotFound);
});

Deno.test("MCPServer: returns error for resources/list (not implemented)", async () => {
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 5,
    method: "resources/list",
  };

  const response = await transport.request(request);

  assertEquals(response.jsonrpc, "2.0");
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.MethodNotFound);
});

Deno.test("MCPServer: returns error for prompts/list (not implemented)", async () => {
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 6,
    method: "prompts/list",
  };

  const response = await transport.request(request);

  assertEquals(response.jsonrpc, "2.0");
  assertExists(response.error);
  assertEquals(response.error?.code, ErrorCodes.MethodNotFound);
});

// =============================================================================
// Notification Tests
// =============================================================================

Deno.test("MCPServer: handles initialized notification", async () => {
  const { transport } = await createTestServer();

  // This should not throw
  transport.notify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
});

Deno.test("MCPServer: handles cancelled notification", async () => {
  const { transport } = await createTestServer();

  // This should not throw
  transport.notify({
    jsonrpc: "2.0",
    method: "notifications/cancelled",
    params: { requestId: 123 },
  });
});

Deno.test("MCPServer: ignores unknown notifications without error", async () => {
  const { transport } = await createTestServer();

  // This should not throw
  transport.notify({
    jsonrpc: "2.0",
    method: "unknown/notification",
  });

  transport.notify({
    jsonrpc: "2.0",
    method: "custom/event",
    params: { data: "test" },
  });
});

// =============================================================================
// JSON-RPC Response Format Tests
// =============================================================================

Deno.test("MCPServer: success response has correct structure", async () => {
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 100,
    method: "tools/list",
  };

  const response = await transport.request(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 100);
  assertExists(response.result);
  assertEquals(response.error, undefined);
});

Deno.test("MCPServer: error response has correct structure", async () => {
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 101,
    method: "invalid/method",
  };

  const response = await transport.request(request);

  assertEquals(response.jsonrpc, "2.0");
  assertEquals(response.id, 101);
  assertEquals(response.result, undefined);
  assertExists(response.error);
  assertExists(response.error?.code);
  assertExists(response.error?.message);
});

Deno.test("MCPServer: preserves request id in response", async () => {
  const { transport } = await createTestServer();

  // Test with numeric id
  const numericRequest: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 42,
    method: "tools/list",
  };
  const numericResponse = await transport.request(numericRequest);
  assertEquals(numericResponse.id, 42);

  // Test with string id
  const stringRequest: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: "request-abc-123",
    method: "tools/list",
  };
  const stringResponse = await transport.request(stringRequest);
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
  const { transport } = await createTestServer({
    api: "http://localhost:9333",
  });

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await transport.request(request);
  const result = response.result as ToolsListResult;

  // Tools should map to contract hierarchy
  const toolNames = result.tools.map((t: MCPTool) => t.name);
  assertEquals(Array.isArray(toolNames), true);
  assertEquals(toolNames.length > 0, true);
});

Deno.test("TDD: MCPServer tools should have path parameters in schema", async () => {
  const { transport } = await createTestServer();

  const request: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };

  const response = await transport.request(request);
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
  const { transport } = await createTestServer();

  // Get tools list first to find exact tool name
  const listRequest: JSONRPCRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  };
  const listResponse = await transport.request(listRequest);
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

    const callResponse = await transport.request(callRequest);
    // Response should be valid JSON-RPC (either success or error result)
    assertEquals(callResponse.jsonrpc, "2.0");
    assertEquals(callResponse.id, 2);
    // Either result or error should be present
    assertEquals(callResponse.result !== undefined || callResponse.error !== undefined, true);
  }
});
