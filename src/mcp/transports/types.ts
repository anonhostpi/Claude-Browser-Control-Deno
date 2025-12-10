/**
 * MCP Transport type definitions.
 *
 * Provides interfaces for all MCP transport mechanisms:
 * - Stdio: Newline-delimited JSON-RPC over stdin/stdout
 * - HTTP: Streamable HTTP with optional SSE
 * - WebSocket: Bidirectional WebSocket communication
 */

import type { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from "../types.ts";

// =============================================================================
// Core Transport Interface
// =============================================================================

/**
 * MCP Transport interface.
 * All transports must implement this interface for communication with MCPServer.
 */
export interface IMCPTransport {
  /** Start the transport (begin accepting connections/messages) */
  start(): Promise<void>;

  /** Send a JSON-RPC message */
  send(message: JSONRPCMessage): Promise<void>;

  /** Close the transport and clean up resources */
  close(): Promise<void>;

  /** Called when a message is received */
  onmessage?: (message: JSONRPCMessage) => void;

  /** Called on transport error */
  onerror?: (error: Error) => void;

  /** Called when transport closes */
  onclose?: () => void;
}

/**
 * Transport that supports multiple concurrent sessions.
 * Used by HTTP and WebSocket transports.
 */
export interface IMultiSessionTransport extends IMCPTransport {
  /** Send message to a specific session */
  sendTo(sessionId: string, message: JSONRPCMessage): Promise<void>;

  /** Called with session ID when message received */
  onmessage?: (message: JSONRPCMessage, sessionId?: string) => void;
}

// =============================================================================
// Stdio Transport Configuration
// =============================================================================

/**
 * Stdio transport configuration.
 */
export interface StdioTransportConfig {
  /** Input readable stream (default: Deno.stdin.readable) */
  input?: ReadableStream<Uint8Array>;
  /** Output writable stream (default: Deno.stdout.writable) */
  output?: WritableStream<Uint8Array>;
}

// =============================================================================
// HTTP Transport Configuration
// =============================================================================

/**
 * HTTP transport configuration.
 */
export interface HttpTransportConfig {
  /** HTTP server port (default: 8080) */
  port?: number;
  /** HTTP server host (default: "127.0.0.1") */
  host?: string;
  /** MCP endpoint path (default: "/mcp") */
  path?: string;
  /** Enable session management (default: true) */
  enableSessions?: boolean;
  /** Enable JSON response mode for stateless operation (default: false) */
  jsonResponse?: boolean;
  /** Session timeout in ms (default: 30 minutes) */
  sessionTimeout?: number;
  /** Allowed origins for CORS (default: ["http://localhost", "http://127.0.0.1"]) */
  allowedOrigins?: string[];
}

/**
 * HTTP session state.
 */
export interface HttpSession {
  id: string;
  createdAt: number;
  lastActivity: number;
  sseController?: ReadableStreamDefaultController<Uint8Array>;
  /** Pending response resolvers keyed by request ID */
  pendingResponses: Map<string | number, (response: JSONRPCResponse) => void>;
}

// =============================================================================
// WebSocket Transport Configuration
// =============================================================================

/**
 * WebSocket transport configuration.
 */
export interface WebSocketTransportConfig {
  /** WebSocket server port (default: 8080) */
  port?: number;
  /** WebSocket server host (default: "127.0.0.1") */
  host?: string;
  /** WebSocket endpoint path (default: "/mcp") */
  path?: string;
}

/**
 * WebSocket session state.
 */
export interface WsSession {
  id: string;
  socket: WebSocket;
  createdAt: number;
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type { JSONRPCMessage, JSONRPCRequest, JSONRPCResponse, JSONRPCNotification };
