/**
 * MCP Server implementation.
 *
 * Contract-driven MCP server that bridges JSON-RPC 2.0 to REST API calls.
 * Supports multiple transport layers:
 * - Stdio: Newline-delimited JSON-RPC over stdin/stdout
 * - HTTP: Streamable HTTP with optional SSE
 * - WebSocket: Bidirectional WebSocket communication
 *
 * Design follows CLI pattern:
 * - Tool handlers are class members named by tool (e.g., "root:health", "endpoint:info")
 * - Dispatch uses blacklist-based dynamic member lookup
 * - Types are derived from API contracts via IContractMCP interface
 * - Uses typed client hierarchy from src/client/ (Root, Endpoint, Context, Target, Node)
 */

import { Root, Endpoint, Context, Target, Node } from "../client/mod.ts";
import * as API from "../orchestrator/contracts/api.ts";
import type { JSONObject, JSONSerializable } from "../orchestrator/schema.ts";
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCNotification,
  type JSONRPCMessage,
  type InitializeResult,
  type ToolsListResult,
  type ToolsCallParams,
  type ToolsCallResult,
  type MCPTool,
  type IContractMCP,
  type MCPServerConfig,
  ErrorCodes,
} from "./types.ts";
import { DEFAULT_SERVER_URL } from "../orchestrator/server/types.ts";
import type { IMCPTransport, IMultiSessionTransport, HttpTransportConfig, WebSocketTransportConfig } from "./transports/types.ts";
import { tools } from "./tools.ts";

/**
 * MCP Server that bridges JSON-RPC to REST API calls.
 *
 * Supports multiple transport layers via the connect() method.
 * Tool handlers are class members named with colon convention ("root:health").
 * Dispatch uses dynamic member lookup, same pattern as CLI.
 *
 * @example
 * ```ts
 * import { Server as MCPServer } from "./mcp/server.ts";
 * const server = new MCPServer({ api: "http://localhost:9333" });
 * await server.stdio();
 * ```
 */
export class Server implements IContractMCP {
  readonly #root: Root;
  readonly #tools: MCPTool[];
  readonly #config: Required<MCPServerConfig>;
  #initialized = false;
  #transport: IMCPTransport | null = null;
  #currentSessionId?: string;

  constructor(config: MCPServerConfig = {}) {
    this.#config = {
      api: config.api ?? DEFAULT_SERVER_URL,
      name: config.name ?? "cdp-mcp",
      version: config.version ?? "1.0.0",
    };

    this.#root = new Root(this.#config.api);
    this.#tools = tools();
  }

  // ==========================================================================
  // Transport Management
  // ==========================================================================

  /**
   * Connect to a transport and start handling messages.
   * This is the primary way to run the MCP server with any transport.
   */
  async connect(transport: IMCPTransport): Promise<void> {
    this.#transport = transport;

    // Check if transport supports multiple sessions
    const isMultiSession = "sendTo" in transport;

    transport.onmessage = async (message: JSONRPCMessage, sessionId?: string) => {
      this.#currentSessionId = sessionId;

      if ("id" in message && message.id !== undefined) {
        // Request - requires response
        const response = await this.#request(message as JSONRPCRequest);

        // Route response back through transport
        if (isMultiSession && sessionId) {
          await (transport as IMultiSessionTransport).sendTo(sessionId, response);
        } else {
          await transport.send(response);
        }
      } else {
        // Notification - no response
        this.#notification(message as JSONRPCNotification);
      }
    };

    transport.onerror = (error: Error) => {
      console.error("MCP transport error:", error);
    };

    transport.onclose = () => {
      this.#transport = null;
    };

    await transport.start();
  }

  /**
   * Run with stdio transport.
   * Convenience method for CLI usage.
   */
  async stdio(): Promise<void> {
    const { StdioTransport } = await import("./transports/stdio.ts");
    await this.connect(new StdioTransport());
  }

  /**
   * Run with HTTP transport.
   * Convenience method for HTTP server usage.
   */
  async http(config: HttpTransportConfig = {}): Promise<void> {
    const { HttpTransport } = await import("./transports/http.ts");
    await this.connect(new HttpTransport(config));
  }

  /**
   * Run with WebSocket transport.
   * Convenience method for WebSocket server usage.
   */
  async ws(config: WebSocketTransportConfig = {}): Promise<void> {
    const { WebSocketTransport } = await import("./transports/websocket.ts");
    await this.connect(new WebSocketTransport(config));
  }

  // ==========================================================================
  // JSON-RPC Method Handlers (IMCPServer interface)
  // ==========================================================================

  initialize(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const result: InitializeResult = {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: {
        name: this.#config.name,
        version: this.#config.version,
      },
    };

    return Promise.resolve(this.#success(request.id, result));
  }

  "tools/list"(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const result: ToolsListResult = {
      tools: this.#tools,
    };

    return Promise.resolve(this.#success(request.id, result));
  }

  async "tools/call"(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const params = request.params as unknown as ToolsCallParams;

    if (!params?.name) {
      return this.#error(request.id, ErrorCodes.InvalidParams, "Missing tool name");
    }

    const handler = this.#dispatch(params.name);
    if (!handler) {
      return this.#error(request.id, ErrorCodes.InvalidParams, `Unknown tool: ${params.name}`);
    }

    try {
      const result = await handler.call(this, params.arguments ?? {});

      const toolResult: ToolsCallResult = {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };

      return this.#success(request.id, toolResult);
    } catch (error) {
      const toolResult: ToolsCallResult = {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };

      return this.#success(request.id, toolResult);
    }
  }

  // ==========================================================================
  // Root Tool Handlers (IContractMCP interface)
  // ==========================================================================

  async "root:health"(): Promise<{ healthy: boolean }> {
    return { healthy: await this.#root.health() };
  }

  async "root:list"(): Promise<API.Root.ListResponse> {
    return await this.#root.list();
  }

  async "root:killAll"(): Promise<API.Root.KillAllResponse> {
    return await this.#root.killAll();
  }

  // ==========================================================================
  // Endpoint Tool Handlers (IContractMCP interface)
  // ==========================================================================

  #getEndpoint(args: JSONObject): Endpoint {
    const name = args.endpoint as string;
    if (!name) throw new Error("Missing required parameter: endpoint");
    return new Endpoint(this.#root, name);
  }

  async "endpoint:exists"(args: JSONObject): Promise<{ exists: boolean }> {
    return { exists: await this.#getEndpoint(args).exists() };
  }

  async "endpoint:info"(args: JSONObject): Promise<API.Endpoint.InfoResponse> {
    return await this.#getEndpoint(args).info(args as API.Endpoint.InfoRequest);
  }

  async "endpoint:launch"(args: JSONObject): Promise<API.Endpoint.LaunchResponse> {
    return await this.#getEndpoint(args).launch(args as API.Endpoint.LaunchRequest);
  }

  async "endpoint:killAll"(args: JSONObject): Promise<API.Endpoint.KillAllResponse> {
    return await this.#getEndpoint(args).killAll();
  }

  // ==========================================================================
  // Context Tool Handlers (IContractMCP interface)
  // ==========================================================================

  #getContext(args: JSONObject): Context {
    const endpoint = this.#getEndpoint(args);
    const name = args.context as string;
    if (!name) throw new Error("Missing required parameter: context");
    return new Context(endpoint, name);
  }

  async "context:exists"(args: JSONObject): Promise<{ exists: boolean }> {
    return { exists: await this.#getContext(args).exists() };
  }

  async "context:info"(args: JSONObject): Promise<API.Context.InfoResponse> {
    return await this.#getContext(args).info();
  }

  async "context:create"(args: JSONObject): Promise<API.Context.CreateResponse> {
    const context = this.#getContext(args);
    const created = await context.create(args as API.Context.CreateRequest);
    const info = await context.info();
    return { ...info, created } as API.Context.CreateResponse;
  }

  async "context:close"(args: JSONObject): Promise<{ success: boolean }> {
    await this.#getContext(args).close();
    return { success: true };
  }

  // ==========================================================================
  // Target Tool Handlers (IContractMCP interface)
  // ==========================================================================

  #getTarget(args: JSONObject): Target {
    const context = this.#getContext(args);
    const id = args.target as string;
    if (!id) throw new Error("Missing required parameter: target");
    return new Target(context, id);
  }

  async "target:exists"(args: JSONObject): Promise<{ exists: boolean }> {
    return { exists: await this.#getTarget(args).exists() };
  }

  async "target:info"(args: JSONObject): Promise<API.Target.InfoResponse> {
    return await this.#getTarget(args).info(args as API.Target.InfoRequest);
  }

  async "target:cdp"(args: JSONObject): Promise<API.Target.CdpResponse> {
    return await this.#getTarget(args).cdp();
  }

  async "target:control"(args: JSONObject): Promise<API.Target.ControlResponse> {
    return await this.#getTarget(args).control(args as API.Target.ControlRequest);
  }

  async "target:create"(args: JSONObject): Promise<API.Target.CreateResponse> {
    return await this.#getTarget(args).create(args as API.Target.CreateRequest);
  }

  async "target:content"(args: JSONObject): Promise<API.Target.ContentResponse> {
    return await this.#getTarget(args).content(args as API.Target.ContentRequest);
  }

  async "target:emulate"(args: JSONObject): Promise<API.Target.EmulateResponse> {
    return await this.#getTarget(args).emulate(args as API.Target.EmulateRequest);
  }

  async "target:throttle"(args: JSONObject): Promise<API.Target.ThrottleResponse> {
    return await this.#getTarget(args).throttle(args as API.Target.ThrottleRequest);
  }

  async "target:intercept"(args: JSONObject): Promise<API.Target.InterceptResponse> {
    return await this.#getTarget(args).intercept(args as API.Target.InterceptRequest);
  }

  async "target:label"(args: JSONObject): Promise<API.Target.LabelResponse> {
    return await this.#getTarget(args).label(args as API.Target.LabelRequest);
  }

  async "target:close"(args: JSONObject): Promise<{ success: boolean }> {
    await this.#getTarget(args).close();
    return { success: true };
  }

  // ==========================================================================
  // Node Tool Handlers (IContractMCP interface)
  // ==========================================================================

  #getNode(args: JSONObject): Node {
    const target = this.#getTarget(args);
    const id = args.node as string;
    if (!id) throw new Error("Missing required parameter: node");
    return new Node(target, parseInt(id, 10));
  }

  async "node:exists"(args: JSONObject): Promise<{ exists: boolean }> {
    return { exists: await this.#getNode(args).exists() };
  }

  async "node:info"(args: JSONObject): Promise<API.Node.InfoResponse> {
    return await this.#getNode(args).info(args as API.Node.InfoRequest);
  }

  async "node:create"(args: JSONObject): Promise<API.Node.InfoResponse> {
    const created = await this.#getNode(args).create(args as API.Node.CreateRequest);
    return await created.info();
  }

  async "node:replace"(args: JSONObject): Promise<API.Node.ReplaceResponse> {
    return await this.#getNode(args).replace(args as API.Node.ReplaceRequest);
  }

  async "node:interact"(args: JSONObject): Promise<API.Node.InteractResponse> {
    return await this.#getNode(args).interact(args as API.Node.InteractRequest);
  }

  async "node:remove"(args: JSONObject): Promise<{ success: boolean }> {
    await this.#getNode(args).remove();
    return { success: true };
  }

  // ==========================================================================
  // Internal Message Handlers
  // ==========================================================================

  async #request(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const handler = this.#dispatch(request.method);
      if (!handler) {
        return this.#error(request.id, ErrorCodes.MethodNotFound, `Method not found: ${request.method}`);
      }

      return await handler.call(this, request) as JSONRPCResponse;
    } catch (error) {
      return this.#error(
        request.id,
        ErrorCodes.InternalError,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  #notification(notification: JSONRPCNotification): void {
    switch (notification.method) {
      case "notifications/initialized":
        this.#initialized = true;
        break;
      case "notifications/cancelled":
        break;
      default:
        break;
    }
  }

  // ==========================================================================
  // Dispatch Helper
  // ==========================================================================

  /** Blacklisted method names that should not be dispatchable */
  static readonly #blacklist = new Set(["connect", "stdio", "http", "ws", "constructor"]);

  /**
   * Look up and validate a method/tool handler by name.
   * Returns the handler function or undefined if not found/blacklisted.
   */
  #dispatch(name: string): ((...args: unknown[]) => Promise<unknown>) | undefined {
    // Blacklist private/internal methods and transport methods
    if (name.startsWith("#") || name.startsWith("_") || Server.#blacklist.has(name)) {
      return undefined;
    }

    const handler = this[name as keyof this];
    if (handler === undefined || typeof handler !== "function") {
      return undefined;
    }

    return handler as (...args: unknown[]) => Promise<unknown>;
  }

  // ==========================================================================
  // Response Helpers
  // ==========================================================================

  #success(id: string | number, result: JSONSerializable): JSONRPCResponse {
    return { jsonrpc: "2.0", id, result };
  }

  #error(id: string | number, code: number, message: string): JSONRPCResponse {
    return { jsonrpc: "2.0", id, error: { code, message } };
  }
}
