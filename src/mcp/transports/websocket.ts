/**
 * WebSocket Transport for MCP.
 *
 * Provides bidirectional communication over WebSocket.
 * Each WebSocket connection represents a session.
 */

import type {
  IMultiSessionTransport,
  WebSocketTransportConfig,
  WsSession,
  JSONRPCMessage,
} from "./types.ts";
import { ensure_url } from "../../mod.ts";
import { DEFAULT_MCP_PORT } from "../mod.ts";

/**
 * WebSocket transport for MCP.
 * Provides bidirectional communication over WebSocket.
 */
export class WebSocketTransport implements IMultiSessionTransport {
  readonly #config: Required<WebSocketTransportConfig>;
  readonly #sessions = new Map<string, WsSession>();
  #server: Deno.HttpServer | null = null;
  #running = false;

  onmessage?: (message: JSONRPCMessage, sessionId?: string) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(config: WebSocketTransportConfig = {}) {
    const [, url] = ensure_url(config.host);
    this.#config = {
      port: config.port ?? DEFAULT_MCP_PORT,
      host: url.hostname,
      path: config.path ?? "/mcp",
    };
  }

  async start(): Promise<void> {
    if (this.#running) return;
    this.#running = true;

    this.#server = Deno.serve(
      { port: this.#config.port, hostname: this.#config.host },
      (request) => this.#handleRequest(request)
    );

    console.error(`MCP WebSocket server listening on ws://${this.#config.host}:${this.#config.port}${this.#config.path}`);

    await this.#server.finished;
  }

  send(message: JSONRPCMessage): Promise<void> {
    const data = JSON.stringify(message);
    for (const session of this.#sessions.values()) {
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(data);
      }
    }
    return Promise.resolve();
  }

  sendTo(sessionId: string, message: JSONRPCMessage): Promise<void> {
    const session = this.#sessions.get(sessionId);
    if (session && session.socket.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify(message));
    }
    return Promise.resolve();
  }

  async close(): Promise<void> {
    this.#running = false;

    // Close all WebSocket connections
    for (const session of this.#sessions.values()) {
      try {
        session.socket.close(1000, "Server shutting down");
      } catch {
        // Ignore close errors
      }
    }
    this.#sessions.clear();

    if (this.#server) {
      await this.#server.shutdown();
    }
    this.onclose?.();
  }

  #handleRequest(request: Request): Response {
    const url = new URL(request.url);

    // Check path
    if (!url.pathname.startsWith(this.#config.path)) {
      return new Response("Not Found", { status: 404 });
    }

    // Check for WebSocket upgrade
    const upgrade = request.headers.get("Upgrade");
    if (upgrade?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const { socket, response } = Deno.upgradeWebSocket(request, {
      protocol: "mcp",
    });

    const sessionId = crypto.randomUUID();

    socket.onopen = () => {
      this.#sessions.set(sessionId, {
        id: sessionId,
        socket,
        createdAt: Date.now(),
      });
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as JSONRPCMessage;
        this.onmessage?.(message, sessionId);
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    socket.onerror = (event) => {
      const errorMessage = event instanceof ErrorEvent ? event.message : "WebSocket error";
      this.onerror?.(new Error(errorMessage));
    };

    socket.onclose = () => {
      this.#sessions.delete(sessionId);
    };

    return response;
  }
}
