/**
 * MCP Server implementation.
 *
 * Contract-driven MCP server that bridges JSON-RPC 2.0 over stdio to REST API calls.
 * Design follows CLI pattern:
 * - Tool handlers are class members named by tool (e.g., "root:health", "endpoint:info")
 * - Dispatch uses blacklist-based dynamic member lookup
 * - Types are derived from API contracts via IContractMCP interface
 * - Uses typed client hierarchy from src/client/ (Root, Endpoint, Context, Target, Node)
 */

import { Root, Endpoint, Context, Target, Node } from "../client/mod.ts";
import { contracts } from "../orchestrator/contracts/api.ts";
import * as API from "../orchestrator/contracts/api.ts";
import type { JSONObject, JSONSerializable } from "../orchestrator/schema.ts";
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCNotification,
  type InitializeResult,
  type ToolsListResult,
  type ToolsCallParams,
  type ToolsCallResult,
  type MCPTool,
  type IMCPServer,
  type IContractMCP,
  type MCPServerConfig,
  ErrorCodes,
} from "./types.ts";

/**
 * Generate MCP tool schemas from contracts at runtime.
 */
function generateTools(): MCPTool[] {
  const tools: MCPTool[] = [];

  for (const contract of contracts) {
    // Check for mcp config using 'in' operator since not all contracts have it
    const mcp = "mcp" in contract ? contract.mcp as { enabled?: boolean; tool?: string; description?: string } : undefined;
    if (mcp?.enabled === false) continue;

    const toolName = mcp?.tool ?? contract.name;
    const description = mcp?.description ?? contract.description;

    const inputSchema: MCPTool["inputSchema"] = { type: "object" as const };

    // Extract path parameters
    const pathParams = contract.path.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? [];
    const properties: JSONObject = {};

    for (const param of pathParams) {
      properties[param] = { type: "string", description: `Path parameter: ${param}` };
    }

    // Add request body properties if contract has request schema
    if ("request" in contract && contract.request && typeof contract.request === "object") {
      const req = contract.request as { properties?: JSONObject; required?: string[] };
      if (req.properties) {
        Object.assign(properties, req.properties);
      }
    }

    if (Object.keys(properties).length > 0) {
      inputSchema.properties = properties;
    }

    // Required fields = path params + schema required
    const required: string[] = [...pathParams];
    if ("request" in contract && contract.request && typeof contract.request === "object") {
      const req = contract.request as { required?: string[] };
      if (Array.isArray(req.required)) {
        required.push(...req.required.filter((r): r is string => typeof r === "string"));
      }
    }
    if (required.length > 0) {
      inputSchema.required = required;
    }

    tools.push({ name: toolName, description, inputSchema });
  }

  return tools;
}

/**
 * MCP Server that bridges JSON-RPC over stdio to REST API calls.
 *
 * Tool handlers are class members named with colon convention ("root:health").
 * Dispatch uses dynamic member lookup, same pattern as CLI.
 */
export class MCPServer implements IMCPServer, IContractMCP {
  readonly #root: Root;
  readonly #tools: MCPTool[];
  readonly #config: Required<MCPServerConfig>;
  #initialized = false;

  constructor(config: MCPServerConfig = {}) {
    this.#config = {
      apiUrl: config.apiUrl ?? "http://localhost:9333",
      name: config.name ?? "browser-control-mcp",
      version: config.version ?? "1.0.0",
    };

    this.#root = new Root(this.#config.apiUrl);
    this.#tools = generateTools();
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

    return Promise.resolve(this.#successResponse(request.id, result));
  }

  "tools/list"(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const result: ToolsListResult = {
      tools: this.#tools,
    };

    return Promise.resolve(this.#successResponse(request.id, result));
  }

  async "tools/call"(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const params = request.params as unknown as ToolsCallParams;

    if (!params?.name) {
      return this.#errorResponse(request.id, ErrorCodes.InvalidParams, "Missing tool name");
    }

    // Dynamic dispatch to tool handler (same pattern as CLI)
    const toolName = params.name;
    const handler = this[toolName as keyof this];

    if (handler === undefined || typeof handler !== "function") {
      return this.#errorResponse(request.id, ErrorCodes.InvalidParams, `Unknown tool: ${toolName}`);
    }

    try {
      const result = await (handler as (args: JSONObject) => Promise<unknown>)
        .call(this, params.arguments ?? {});

      const toolResult: ToolsCallResult = {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };

      return this.#successResponse(request.id, toolResult);
    } catch (error) {
      const toolResult: ToolsCallResult = {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };

      return this.#successResponse(request.id, toolResult);
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
  // Main Entry Points (IMCPServer interface)
  // ==========================================================================

  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const method = request.method;

      // Blacklist private/internal methods
      if (method.startsWith("#") || method.startsWith("_")) {
        return this.#errorResponse(request.id, ErrorCodes.MethodNotFound, `Method not found: ${method}`);
      }

      // Look up the method on this instance
      const handler = this[method as keyof this];
      if (handler === undefined || typeof handler !== "function") {
        return this.#errorResponse(request.id, ErrorCodes.MethodNotFound, `Method not found: ${method}`);
      }

      // Call the handler
      return await (handler as (req: JSONRPCRequest) => Promise<JSONRPCResponse>).call(this, request);
    } catch (error) {
      return this.#errorResponse(
        request.id,
        ErrorCodes.InternalError,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  handleNotification(notification: JSONRPCNotification): void {
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

  async run(): Promise<void> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const reader = Deno.stdin.readable.getReader();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value);
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const message = JSON.parse(line);
            if ("id" in message) {
              const response = await this.handleRequest(message as JSONRPCRequest);
              await Deno.stdout.write(encoder.encode(JSON.stringify(response) + "\n"));
            } else {
              this.handleNotification(message as JSONRPCNotification);
            }
          } catch {
            const response: JSONRPCResponse = {
              jsonrpc: "2.0",
              id: 0,
              error: { code: ErrorCodes.ParseError, message: "Parse error" },
            };
            await Deno.stdout.write(encoder.encode(JSON.stringify(response) + "\n"));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ==========================================================================
  // Response Helpers
  // ==========================================================================

  #successResponse(id: string | number, result: JSONSerializable): JSONRPCResponse {
    return { jsonrpc: "2.0", id, result };
  }

  #errorResponse(id: string | number, code: number, message: string): JSONRPCResponse {
    return { jsonrpc: "2.0", id, error: { code, message } };
  }
}
