/**
 * MCP CLI Command Definitions.
 *
 * Defines MCP-related CLI commands colocated with the MCP transport implementations.
 */

import { Server } from "./server.ts";
import { DEFAULT_SERVER_URL, DEFAULT_SERVER_HOSTNAME, ensure_url } from "../orchestrator/server/types.ts";
import { DEFAULT_MCP_PORT } from "./mod.ts";
import type { HttpTransportConfig, WebSocketTransportConfig } from "./transports/types.ts";
import type { ICLIContext, CommandEntry } from "../cli/cli.ts";

/**
 * MCP command registrar for CLI.
 * Returns a map of command names to commands with handlers and metadata.
 */
export function CommandRegistrar(context: ICLIContext): Record<string, CommandEntry> {
  return {
    "serve:mcp-stdio": {
      description: "Serve MCP over stdio transport (standard for CLI/IDE integrations)",
      flags: [
        { name: "server", short: "s", description: `REST API server URL (default: ${DEFAULT_SERVER_URL})` },
      ],
      handler: async (): Promise<void> => {
        const api = context.optional("server");
        const server = new Server({ api });
        await server.stdio();
      },
    },

    "serve:mcp-http": {
      description: "Serve MCP over HTTP transport with optional SSE",
      flags: [
        { name: "server", short: "s", description: `REST API server URL (default: ${DEFAULT_SERVER_URL})` },
        { name: "host", short: "i", description: `HTTP server host (default: ${DEFAULT_SERVER_HOSTNAME})` },
        { name: "port", short: "p", description: `HTTP server port (default: ${DEFAULT_MCP_PORT})` },
      ],
      handler: async (): Promise<void> => {
        const [api, url] = ensure_url(context.optional("server"));
        const _port = context.optional("port");
        const host = context.optional("host") ?? url.hostname;
        const port = _port ? parseInt(_port) : DEFAULT_MCP_PORT;

        const config: HttpTransportConfig = { host, port };
        const server = new Server({ api });
        await server.http(config);
      },
    },

    "serve:mcp-ws": {
      description: "Serve MCP over WebSocket transport",
      flags: [
        { name: "server", short: "s", description: `REST API server URL (default: ${DEFAULT_SERVER_URL})` },
        { name: "host", short: "i", description: `WebSocket server host (default: ${DEFAULT_SERVER_HOSTNAME})` },
        { name: "port", short: "p", description: `WebSocket server port (default: ${DEFAULT_MCP_PORT})` },
      ],
      handler: async (): Promise<void> => {
        const [api, url] = ensure_url(context.optional("server"));
        const _port = context.optional("port");
        const host = context.optional("host") ?? url.hostname;
        const port = _port ? parseInt(_port) : DEFAULT_MCP_PORT;

        const config: WebSocketTransportConfig = { host, port };
        const server = new Server({ api });
        await server.ws(config);
      },
    },
  };
}
