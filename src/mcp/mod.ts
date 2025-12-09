/**
 * MCP (Model Context Protocol) server module.
 *
 * This module provides a contract-driven MCP server that bridges Claude to the
 * browser control REST API. Design follows CLI pattern with type-safe interfaces
 * derived from API contracts.
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

export { MCPServer } from "./server.ts";
export type { MCPServerConfig } from "./types.ts";

// Re-export all types for consumers
export * from "./types.ts";
