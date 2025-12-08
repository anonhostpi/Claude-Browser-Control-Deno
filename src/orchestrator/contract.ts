import { JSONSchema } from "json-schema-to-ts";
export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

/**
 * MCP tool configuration for a contract.
 * When present, the transpiler will generate MCP tool definitions.
 */
export type MCPToolConfig = {
  /** Tool name for MCP (defaults to contract name with : replaced by _) */
  tool?: string;
  /** Tool description for MCP (defaults to contract description) */
  description?: string;
  /** Whether to expose this contract as an MCP tool (defaults to true if mcp field present) */
  enabled?: boolean;
};

export type EndpointContract<
  RequestSchema extends JSONSchema = JSONSchema,
  ResponseSchema extends JSONSchema = JSONSchema,
  ErrorSchema extends JSONSchema = JSONSchema,
  Name extends string = string
> = {
  name: Name; // unique identifier for filtering via `T extends { name: "..." }`
  path: string;
  method: Method;
  description: string; // description of the method
  request?: RequestSchema; // JSON Schema for the request body
  error?: ErrorSchema; // JSON Schema for usercode-defined errors
  response: ResponseSchema; // JSON Schema for the response body
  module: string; // module where the method is defined for server-side
  mcp?: MCPToolConfig; // MCP tool configuration (optional)
  websocket?: boolean; // Enable WebSocket upgrade support (additive to HTTP)
};
