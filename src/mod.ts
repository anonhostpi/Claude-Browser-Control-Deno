/**
 * Claude Browser Control for Deno
 *
 * A library for controlling Chrome-based browsers via CDP
 * @module
 */

// Client - Contract-driven browser control client
export * from "./client/mod.ts";

// CLI - Command-line interface
export * from "./cli/mod.ts";

// MCP - Model Context Protocol server
export { Server as MCPServer } from "./mcp/server.ts";
export type {
  MCPServerConfig,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCNotification,
  MCPTool,
  ToolsListResult,
  ToolsCallParams,
  ToolResultContent,
  ToolsCallResult,
  InitializeResult,
} from "./mcp/types.ts";
export { ErrorCodes } from "./mcp/types.ts";

// Orchestrator - Contract-driven REST framework
export * from "./orchestrator/client/mod.ts";
export * from "./orchestrator/server/mod.ts";
export * from "./orchestrator/contract.ts";
export * from "./orchestrator/loader.ts";
export {
  transpile,
  transpileSync,
  getDefaultOutputPath,
  type TranspileOptions,
  type TranspileResult,
} from "./orchestrator/transpile.ts";
