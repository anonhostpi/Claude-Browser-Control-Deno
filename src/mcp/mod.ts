/**
 * MCP (Model Context Protocol) server module.
 *
 * This module provides a contract-driven MCP server that bridges Claude to the
 * browser control REST API. Supports multiple transport layers:
 * - Stdio: Newline-delimited JSON-RPC over stdin/stdout
 * - HTTP: Streamable HTTP with optional SSE
 * - WebSocket: Bidirectional WebSocket communication
 *
 * @example Stdio transport (default)
 * ```ts
 * import { Server as MCPServer } from "./mcp/mod.ts";
 *
 * const server = new MCPServer({ api: "http://localhost:9333" });
 * await server.stdio();
 * ```
 *
 * @example HTTP transport
 * ```ts
 * import { Server as MCPServer } from "./mcp/mod.ts";
 *
 * const server = new MCPServer({ api: "http://localhost:9333" });
 * await server.http({ port: 8080 });
 * ```
 *
 * @example WebSocket transport
 * ```ts
 * import { Server as MCPServer } from "./mcp/mod.ts";
 *
 * const server = new MCPServer({ api: "http://localhost:9333" });
 * await server.ws({ port: 8080 });
 * ```
 *
 * @example Custom transport
 * ```ts
 * import { Server as MCPServer, StdioTransport } from "./mcp/mod.ts";
 *
 * const server = new MCPServer({ api: "http://localhost:9333" });
 * const transport = new StdioTransport();
 * await server.connect(transport);
 * ```
 */

export { Server } from "./server.ts";
export type { MCPServerConfig } from "./types.ts";

export const DEFAULT_MCP_PORT = 8080;

// Re-export all types for consumers
export * from "./types.ts";

// Transport exports
export {
  StdioTransport,
  HttpTransport,
  WebSocketTransport,
} from "./transports/mod.ts";

export type {
  IMCPTransport,
  IMultiSessionTransport,
  StdioTransportConfig,
  HttpTransportConfig,
  WebSocketTransportConfig,
} from "./transports/mod.ts";

// CLI command exports
export { CommandRegistrar } from "./cli.ts";
