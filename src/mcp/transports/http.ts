/**
 * Streamable HTTP Transport for MCP.
 *
 * Implements the modern MCP HTTP transport protocol:
 * - POST /mcp: Client sends JSON-RPC requests
 * - GET /mcp: Client opens SSE stream for server-initiated messages
 * - DELETE /mcp: Client terminates session
 *
 * Supports both stateful (session-based) and stateless modes.
 */

import type {
  IMultiSessionTransport,
  HttpTransportConfig,
  HttpSession,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCResponse,
} from "./types.ts";
import { ErrorCodes } from "../types.ts";
import { DEFAULT_SERVER_HOSTNAME, ensure_url } from "../../orchestrator/server/types.ts";
import { DEFAULT_MCP_PORT } from "../mod.ts";

const origins = {
  allowed(url: string): string[] {
    try {
      const [, parsed] = ensure_url(url);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return [`${parsed.protocol}//localhost`, `${parsed.protocol}//127.0.0.1`];
      }
      return [`${parsed.protocol}//${parsed.host}`];
    } catch {
      return [`http://localhost`, `http://127.0.0.1`];
    }
  },
  validate(origin: string, whitelist: string[]): boolean {
    // Always allow localhost variants
    const parsed = new URL(origin);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return true;
    }

    // Check against whitelist
    return whitelist.some(allowed => origin.startsWith(allowed));
  }
}

/**
 * Streamable HTTP transport for MCP.
 * Implements the modern MCP HTTP transport protocol.
 */
export class HttpTransport implements IMultiSessionTransport {
  readonly #config: Required<HttpTransportConfig>;
  readonly #sessions = new Map<string, HttpSession>();
  #server: Deno.HttpServer | null = null;
  #running = false;
  #cleanupInterval: number | null = null;

  onmessage?: (message: JSONRPCMessage, sessionId?: string) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(config: HttpTransportConfig = {}) {
    const host = config.host ?? DEFAULT_SERVER_HOSTNAME;
    this.#config = {
      host,
      port: config.port ?? DEFAULT_MCP_PORT,
      path: config.path ?? "/mcp",
      enableSessions: config.enableSessions ?? true,
      jsonResponse: config.jsonResponse ?? false,
      sessionTimeout: config.sessionTimeout ?? 30 * 60 * 1000,
      allowedOrigins: config.allowedOrigins ?? origins.allowed(host)
    };
  }

  async start(): Promise<void> {
    if (this.#running) return;
    this.#running = true;

    this.#server = Deno.serve(
      { port: this.#config.port, hostname: this.#config.host },
      (request) => this.#handleRequest(request)
    );

    // Start session cleanup interval
    this.#startSessionCleanup();

    console.error(`MCP HTTP server listening on http://${this.#config.host}:${this.#config.port}${this.#config.path}`);

    await this.#server.finished;
  }

  send(message: JSONRPCMessage): Promise<void> {
    // Broadcast to all sessions with SSE streams
    for (const session of this.#sessions.values()) {
      if (session.sseController) {
        this.#sendSSE(session.sseController, message);
      }
    }
    return Promise.resolve();
  }

  sendTo(sessionId: string, message: JSONRPCMessage): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (!session) return Promise.resolve();

    // If this is a response and there's a pending resolver, use it
    if ("id" in message && message.id !== undefined) {
      const resolver = session.pendingResponses.get(message.id);
      if (resolver) {
        resolver(message as JSONRPCResponse);
        session.pendingResponses.delete(message.id);
        return Promise.resolve();
      }
    }

    // Otherwise send via SSE if available
    if (session.sseController) {
      this.#sendSSE(session.sseController, message);
    }
    return Promise.resolve();
  }

  async close(): Promise<void> {
    this.#running = false;

    if (this.#cleanupInterval !== null) {
      clearInterval(this.#cleanupInterval);
      this.#cleanupInterval = null;
    }

    // Close all SSE streams
    for (const session of this.#sessions.values()) {
      if (session.sseController) {
        try {
          session.sseController.close();
        } catch {
          // Ignore close errors
        }
      }
    }
    this.#sessions.clear();

    if (this.#server) {
      await this.#server.shutdown();
    }
    this.onclose?.();
  }

  #handleRequest(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);

    // Check path
    if (!url.pathname.startsWith(this.#config.path)) {
      return new Response("Not Found", { status: 404 });
    }

    // Validate Origin header (DNS rebinding protection)
    const origin = request.headers.get("Origin");
    if (origin && !origins.validate(origin, this.#config.allowedOrigins)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Add CORS headers
    const corsHeaders: HeadersInit = {
      "Access-Control-Allow-Origin": origin ?? "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Accept",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    switch (request.method) {
      case "POST":
        return this.#handlePost(request, corsHeaders);
      case "GET":
        return this.#handleGet(request, corsHeaders);
      case "DELETE":
        return this.#handleDelete(request, corsHeaders);
      default:
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }
  }

  async #handlePost(request: Request, corsHeaders: HeadersInit): Promise<Response> {
    const sessionId = request.headers.get("Mcp-Session-Id");

    // Parse JSON-RPC message
    let message: JSONRPCMessage;
    try {
      message = await request.json();
    } catch {
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: ErrorCodes.ParseError, message: "Parse error" }
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check if this is an initialize request
    const isInitialize = "method" in message && message.method === "initialize";

    // Handle initialization - create new session
    if (isInitialize) {
      const newSessionId = this.#config.enableSessions ? crypto.randomUUID() : undefined;

      if (newSessionId) {
        this.#sessions.set(newSessionId, {
          id: newSessionId,
          createdAt: Date.now(),
          lastActivity: Date.now(),
          pendingResponses: new Map(),
        });
      }

      // Create promise to wait for response
      return new Promise<Response>((resolve) => {
        const requestId = (message as JSONRPCRequest).id;

        if (newSessionId) {
          const session = this.#sessions.get(newSessionId)!;
          session.pendingResponses.set(requestId, (response) => {
            const headers: HeadersInit = { ...corsHeaders, "Content-Type": "application/json" };
            if (newSessionId) {
              headers["Mcp-Session-Id"] = newSessionId;
            }
            resolve(new Response(JSON.stringify(response), { headers }));
          });
        }

        // Trigger message handler
        this.onmessage?.(message, newSessionId);

        // If no session tracking, resolve immediately after a timeout
        if (!newSessionId) {
          setTimeout(() => {
            resolve(new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: requestId,
              error: { code: ErrorCodes.InternalError, message: "No session support" }
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }));
          }, 5000);
        }
      });
    }

    // Validate session for non-init requests
    if (this.#config.enableSessions) {
      if (!sessionId) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: ErrorCodes.InvalidRequest, message: "Missing Mcp-Session-Id header" }
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (!this.#sessions.has(sessionId)) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: ErrorCodes.InvalidRequest, message: "Session not found" }
        }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const session = this.#sessions.get(sessionId)!;
      session.lastActivity = Date.now();
    }

    // For notifications (no id), return 202 Accepted
    if (!("id" in message) || message.id === undefined) {
      this.onmessage?.(message, sessionId ?? undefined);
      return new Response(null, { status: 202, headers: corsHeaders });
    }

    // For requests, wait for response
    return new Promise<Response>((resolve) => {
      const requestId = (message as JSONRPCRequest).id;

      if (sessionId && this.#config.enableSessions) {
        const session = this.#sessions.get(sessionId)!;
        session.pendingResponses.set(requestId, (response) => {
          resolve(new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }));
        });
      }

      // Trigger message handler
      this.onmessage?.(message, sessionId ?? undefined);

      // Timeout for response
      setTimeout(() => {
        if (sessionId) {
          const session = this.#sessions.get(sessionId);
          if (session?.pendingResponses.has(requestId)) {
            session.pendingResponses.delete(requestId);
            resolve(new Response(JSON.stringify({
              jsonrpc: "2.0",
              id: requestId,
              error: { code: ErrorCodes.InternalError, message: "Request timeout" }
            }), {
              status: 504,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            }));
          }
        }
      }, 30000);
    });
  }

  #handleGet(request: Request, corsHeaders: HeadersInit): Response {
    const accept = request.headers.get("Accept");
    if (!accept?.includes("text/event-stream")) {
      return new Response("Not Acceptable - Expected Accept: text/event-stream", {
        status: 406,
        headers: corsHeaders
      });
    }

    const sessionId = request.headers.get("Mcp-Session-Id");
    if (this.#config.enableSessions && (!sessionId || !this.#sessions.has(sessionId))) {
      return new Response("Session Not Found", { status: 404, headers: corsHeaders });
    }

    // Create SSE stream
    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        if (sessionId) {
          const session = this.#sessions.get(sessionId)!;
          session.sseController = controller;
          session.lastActivity = Date.now();
        }

        // Send initial comment to establish connection
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(": MCP SSE stream established\n\n"));
      },
      cancel: () => {
        if (sessionId) {
          const session = this.#sessions.get(sessionId);
          if (session) {
            session.sseController = undefined;
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      }
    });
  }

  #handleDelete(request: Request, corsHeaders: HeadersInit): Response {
    const sessionId = request.headers.get("Mcp-Session-Id");
    if (sessionId) {
      const session = this.#sessions.get(sessionId);
      if (session?.sseController) {
        try {
          session.sseController.close();
        } catch {
          // Ignore close errors
        }
      }
      this.#sessions.delete(sessionId);
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  #sendSSE(controller: ReadableStreamDefaultController<Uint8Array>, message: JSONRPCMessage): void {
    try {
      const encoder = new TextEncoder();
      const eventId = crypto.randomUUID();
      const data = `id: ${eventId}\ndata: ${JSON.stringify(message)}\n\n`;
      controller.enqueue(encoder.encode(data));
    } catch {
      // Stream may be closed
    }
  }

  #startSessionCleanup(): void {
    this.#cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.#sessions) {
        if (now - session.lastActivity > this.#config.sessionTimeout) {
          if (session.sseController) {
            try {
              session.sseController.close();
            } catch {
              // Ignore
            }
          }
          this.#sessions.delete(id);
        }
      }
    }, 60000) as unknown as number; // Check every minute
  }
}
