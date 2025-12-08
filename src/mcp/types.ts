/**
 * MCP (Model Context Protocol) type definitions.
 *
 * Based on the MCP specification for JSON-RPC 2.0 communication.
 * @see https://modelcontextprotocol.io/
 */

/**
 * JSON-RPC 2.0 request structure
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 response structure
 */
export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: JSONRPCError;
}

/**
 * JSON-RPC 2.0 error structure
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC 2.0 notification (no id, no response expected)
 */
export interface JSONRPCNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP tools/list response
 */
export interface ToolsListResult {
  tools: MCPTool[];
}

/**
 * MCP tools/call request params
 */
export interface ToolsCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

/**
 * MCP tools/call response - content block
 */
export interface ToolResultContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string; // base64 for images
  mimeType?: string;
}

/**
 * MCP tools/call response
 */
export interface ToolsCallResult {
  content: ToolResultContent[];
  isError?: boolean;
}

/**
 * MCP initialize request params
 */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: {
    roots?: { listChanged?: boolean };
    sampling?: Record<string, unknown>;
  };
  clientInfo: {
    name: string;
    version: string;
  };
}

/**
 * MCP initialize response
 */
export interface InitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
  };
  serverInfo: {
    name: string;
    version: string;
  };
}

/**
 * Standard JSON-RPC error codes
 */
export const ErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;
