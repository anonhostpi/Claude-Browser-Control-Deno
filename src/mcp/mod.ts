/**
 * MCP (Model Context Protocol) server module.
 *
 * This module provides an MCP server that bridges Claude to the
 * browser control REST API.
 *
 * @example
 * ```ts
 * import { MCPServer } from "./mcp/mod.ts";
 *
 * const server = new MCPServer({
 *   apiUrl: "http://localhost:9333",
 * });
 *
 * await server.run();
 * ```
 */

export { MCPServer, type MCPServerConfig } from "./server.ts";
export * from "./types.ts";
