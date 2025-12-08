/**
 * MCP Server implementation.
 *
 * This server communicates via JSON-RPC 2.0 over stdio and acts as a
 * REST client to the browser control API server.
 */

import { dirname, fromFileUrl, resolve } from "@std/path";
import { Client } from "../orchestrator/client/client.ts";
import { transpileSync, type MCPTool } from "../orchestrator/transpile.ts";
import type { EndpointContract } from "../orchestrator/contract.ts";
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCNotification,
  type InitializeParams,
  type InitializeResult,
  type ToolsListResult,
  type ToolsCallParams,
  type ToolsCallResult,
  ErrorCodes,
} from "./types.ts";

/**
 * Get the default contracts path relative to this module.
 */
function getDefaultContractsPath(): string {
  const thisDir = dirname(fromFileUrl(import.meta.url));
  return resolve(thisDir, "../orchestrator/contracts/api.yaml");
}

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  /** REST API server URL (default: http://localhost:9333) */
  apiUrl?: string;
  /** Path to contracts file (for generating tool schemas) */
  contractsPath?: string;
  /** Server name for MCP initialization */
  name?: string;
  /** Server version for MCP initialization */
  version?: string;
}

/**
 * MCP Server that bridges JSON-RPC over stdio to REST API calls.
 */
export class MCPServer {
  private client: Client;
  private tools: MCPTool[] = [];
  private contractsByToolName: Map<string, EndpointContract> = new Map();
  private config: Required<MCPServerConfig>;
  private initialized = false;

  constructor(config: MCPServerConfig = {}) {
    this.config = {
      apiUrl: config.apiUrl ?? "http://localhost:9333",
      contractsPath: config.contractsPath ?? getDefaultContractsPath(),
      name: config.name ?? "browser-control-mcp",
      version: config.version ?? "1.0.0",
    };

    this.client = new Client(this.config.apiUrl);
    this.loadTools();
  }

  /**
   * Load tools from contracts
   */
  private loadTools(): void {
    try {
      const result = transpileSync(this.config.contractsPath);
      this.tools = result.mcpTools;

      // Map tool names to contracts for REST calls
      for (const contract of result.contracts.contracts) {
        const toolName = contract.mcp?.tool ?? contract.name.replace(/:/g, "_");
        this.contractsByToolName.set(toolName, contract);
      }
    } catch (error) {
      console.error("Failed to load contracts:", error);
      this.tools = [];
    }
  }

  /**
   * Handle incoming JSON-RPC request
   */
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);

        case "tools/list":
          return this.handleToolsList(request);

        case "tools/call":
          return await this.handleToolsCall(request);

        default:
          return this.errorResponse(request.id, ErrorCodes.MethodNotFound, `Method not found: ${request.method}`);
      }
    } catch (error) {
      return this.errorResponse(
        request.id,
        ErrorCodes.InternalError,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handle notifications (no response expected)
   */
  handleNotification(notification: JSONRPCNotification): void {
    switch (notification.method) {
      case "notifications/initialized":
        this.initialized = true;
        break;

      case "notifications/cancelled":
        // Handle cancellation if needed
        break;

      default:
        // Ignore unknown notifications
        break;
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(request: JSONRPCRequest): JSONRPCResponse {
    const _params = request.params as unknown as InitializeParams;

    const result: InitializeResult = {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: this.config.name,
        version: this.config.version,
      },
    };

    return this.successResponse(request.id, result);
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(request: JSONRPCRequest): JSONRPCResponse {
    const result: ToolsListResult = {
      tools: this.tools,
    };

    return this.successResponse(request.id, result);
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const params = request.params as unknown as ToolsCallParams;

    if (!params?.name) {
      return this.errorResponse(request.id, ErrorCodes.InvalidParams, "Missing tool name");
    }

    const contract = this.contractsByToolName.get(params.name);
    if (!contract) {
      return this.errorResponse(request.id, ErrorCodes.InvalidParams, `Unknown tool: ${params.name}`);
    }

    try {
      // Build the path with path parameters substituted
      let path = contract.path;
      const args = params.arguments ?? {};
      const bodyArgs: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(args)) {
        if (path.includes(`:${key}`)) {
          // This is a path parameter
          path = path.replace(`:${key}`, String(value));
        } else {
          // This goes in the body
          bodyArgs[key] = value;
        }
      }

      // Make the REST API call
      const response = await this.makeApiCall(contract.method, path, bodyArgs);

      const result: ToolsCallResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };

      return this.successResponse(request.id, result);
    } catch (error) {
      const result: ToolsCallResult = {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };

      return this.successResponse(request.id, result);
    }
  }

  /**
   * Make a REST API call
   */
  private async makeApiCall(
    method: string,
    path: string,
    body: Record<string, unknown>
  ): Promise<unknown> {
    const hasBody = Object.keys(body).length > 0;

    switch (method) {
      case "GET":
        return await this.client.get(path);
      case "POST":
        return await this.client.post(path, hasBody ? body : undefined);
      case "PUT":
        return await this.client.put(path, hasBody ? body : undefined);
      case "PATCH":
        return await this.client.patch(path, hasBody ? body : undefined);
      case "DELETE":
        await this.client.delete(path);
        return { success: true };
      case "HEAD":
        await this.client.head(path);
        return { exists: true };
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }

  /**
   * Create a success response
   */
  private successResponse(id: string | number, result: unknown): JSONRPCResponse {
    return {
      jsonrpc: "2.0",
      id,
      result,
    };
  }

  /**
   * Create an error response
   */
  private errorResponse(id: string | number, code: number, message: string): JSONRPCResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message },
    };
  }

  /**
   * Run the server, reading from stdin and writing to stdout
   */
  async run(): Promise<void> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Read from stdin
    const reader = Deno.stdin.readable.getReader();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);

        // Process complete lines (JSON-RPC messages are newline-delimited)
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message = JSON.parse(line);

            if ("id" in message) {
              // It's a request
              const response = await this.handleRequest(message as JSONRPCRequest);
              const output = JSON.stringify(response) + "\n";
              await Deno.stdout.write(encoder.encode(output));
            } else {
              // It's a notification
              this.handleNotification(message as JSONRPCNotification);
            }
          } catch {
            // Parse error
            const response: JSONRPCResponse = {
              jsonrpc: "2.0",
              id: 0,
              error: { code: ErrorCodes.ParseError, message: "Parse error" },
            };
            const output = JSON.stringify(response) + "\n";
            await Deno.stdout.write(encoder.encode(output));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
