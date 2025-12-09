/**
 * MCP (Model Context Protocol) type definitions.
 *
 * Provides:
 * - JSON-RPC 2.0 types from official MCP SDK (with corrections for JSONSerializable)
 * - Contract-derived interfaces for type-safe tool handling
 * - Tool schema types for MCP specification compliance
 *
 * @see https://modelcontextprotocol.io/
 */

import * as API from "../orchestrator/contracts/api.ts";
import type { JSONSerializable, JSONObject } from "../orchestrator/schema.ts";
import type { PathParams } from "../client/core.ts";

// =============================================================================
// JSON-RPC 2.0 Types (from @modelcontextprotocol/sdk, corrected for JSONSerializable)
// =============================================================================

// Re-export SDK constants
export {
  JSONRPC_VERSION,
  LATEST_PROTOCOL_VERSION,
  ErrorCode as ErrorCodes,
} from "@modelcontextprotocol/sdk/types.js";

import * as sdk from "@modelcontextprotocol/sdk/types.js";

// Import RequestId type from SDK
import type { RequestId } from "@modelcontextprotocol/sdk/types.js";

/**
 * JSON-RPC 2.0 request structure.
 * Corrected to use JSONObject for params (JSONSerializable-compatible).
 */
export interface JSONRPCRequest extends sdk.JSONRPCRequest {
  params?: sdk.JSONRPCRequest["params"] & JSONObject;
}

/**
 * JSON-RPC 2.0 error structure.
 * Corrected to use JSONSerializable for data.
 */
export interface JSONRPCError extends sdk.JSONRPCError {
  error: sdk.JSONRPCError["error"] & { data?: JSONSerializable };
}

/**
 * JSON-RPC 2.0 response structure.
 * Note: SDK separates success (JSONRPCResponse) and error (JSONRPCError) responses.
 * We unify them for simpler handling, widening result to accept JSONSerializable.
 */
export interface JSONRPCResponse {
  jsonrpc: typeof sdk.JSONRPC_VERSION;
  id: RequestId;
  result?: JSONSerializable;
  error?: sdk.JSONRPCError["error"] & { data?: JSONSerializable };
}

/**
 * JSON-RPC 2.0 notification (no id, no response expected).
 * Corrected to use JSONObject for params.
 */
export interface JSONRPCNotification extends sdk.JSONRPCNotification {
  params?: sdk.JSONRPCNotification["params"] & JSONObject;
}

/**
 * Union of all JSON-RPC message types.
 */
export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification;

// =============================================================================
// MCP Tool Schema Types (from @modelcontextprotocol/sdk, corrected)
// =============================================================================

/**
 * MCP Tool input schema.
 * Extends SDK's inputSchema, widening properties to accept JSONObject.
 */
export type MCPToolInputSchema = Omit<sdk.Tool["inputSchema"], "properties"> & JSONObject & {
  type: "object";
  properties?: JSONObject;
  required?: string[];
};

/**
 * MCP Tool definition.
 * Extends SDK Tool with our widened inputSchema, with JSONObject for compatibility.
 */
export type MCPTool = Omit<sdk.Tool, "inputSchema"> & JSONObject & {
  inputSchema: MCPToolInputSchema;
};

/**
 * MCP tools/list response.
 * Corrected to use our MCPTool type, with JSONObject for compatibility.
 */
export type ToolsListResult = Omit<sdk.ListToolsResult, "tools"> & JSONObject & {
  tools: MCPTool[];
};

/**
 * MCP tools/call request params.
 * Corrected arguments to use JSONObject.
 */
export interface ToolsCallParams extends Omit<sdk.CallToolRequestParams, "arguments"> {
  name: string;
  arguments?: JSONObject;
}

/**
 * MCP tools/call response content block.
 * Type-corrected from SDK's content types.
 */
export type ToolResultContent = sdk.TextContent | sdk.ImageContent | sdk.EmbeddedResource;

/**
 * MCP tools/call response.
 * Extended from SDK CallToolResult with JSONObject for compatibility.
 */
export type ToolsCallResult = sdk.CallToolResult & JSONObject & {
  content: ToolResultContent[];
};

/**
 * MCP initialize response.
 * Extended from SDK InitializeResult with JSONObject for compatibility.
 */
export type InitializeResult = sdk.InitializeResult & JSONObject;

// =============================================================================
// Contract-Derived MCP Tool Types
// =============================================================================

/**
 * MCP tool handler function type.
 * Takes arguments (path params + request body) and returns JSON-serializable result.
 */
export type MCPToolHandler<TArgs = JSONObject, TResult = JSONSerializable> =
  (args: TArgs) => Promise<TResult>;

/**
 * IContractMCP interface - tool handlers with underscore naming convention.
 * Used to enforce that MCPServer implements all contract tools.
 * Auto-generated in api.ts from all contract namespaces.
 */
export type IContractMCP = API.IContractMCP<MCPToolHandler>;

/**
 * MCP method handler type for JSON-RPC methods
 */
export type MCPMethodHandler = (request: JSONRPCRequest) => Promise<JSONRPCResponse>;

/**
 * MCP server interface - JSON-RPC methods
 */
export interface IMCPServer {
  // JSON-RPC method handlers
  initialize(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  "tools/list"(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  "tools/call"(request: JSONRPCRequest): Promise<JSONRPCResponse>;

  // Main entry points
  handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse>;
  handleNotification(notification: JSONRPCNotification): void;
  run(): Promise<void>;
}

// =============================================================================
// Tool Name Mappings
// =============================================================================

/**
 * All MCP tool names (with underscores), derived from IContractMCP interface.
 */
export type ToolName = keyof IContractMCP;

// =============================================================================
// Path Parameter Types (re-exported from client/core.ts)
// =============================================================================

export type { PathParams };

/**
 * Root-level tool arguments (no path params)
 */
export type RootToolArgs = JSONObject;

/**
 * Endpoint-level tool arguments
 */
export interface EndpointToolArgs extends PathParams {
  endpoint: string;
}

/**
 * Context-level tool arguments
 */
export interface ContextToolArgs extends EndpointToolArgs {
  context: string;
}

/**
 * Target-level tool arguments
 */
export interface TargetToolArgs extends ContextToolArgs {
  target: string;
}

/**
 * Node-level tool arguments
 */
export interface NodeToolArgs extends TargetToolArgs {
  node: string;
}

// =============================================================================
// MCP Server Configuration
// =============================================================================

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** REST API server URL (default: http://localhost:9333) */
  apiUrl?: string;
  /** Server name for MCP initialization */
  name?: string;
  /** Server version for MCP initialization */
  version?: string;
}
