/**
 * Stdio Transport for MCP.
 *
 * Communicates via newline-delimited JSON-RPC 2.0 over stdin/stdout.
 * This is the standard transport for local CLI integrations.
 */

import type { IMCPTransport, StdioTransportConfig, JSONRPCMessage } from "./types.ts";

/**
 * Stdio transport for MCP.
 * Communicates via newline-delimited JSON over stdin/stdout.
 */
export class StdioTransport implements IMCPTransport {
  readonly #input: ReadableStream<Uint8Array>;
  readonly #output: WritableStream<Uint8Array>;
  #reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  #writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  #buffer = "";
  #running = false;
  readonly #decoder = new TextDecoder();
  readonly #encoder = new TextEncoder();

  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(config: StdioTransportConfig = {}) {
    this.#input = config.input ?? Deno.stdin.readable;
    this.#output = config.output ?? Deno.stdout.writable;
  }

  async start(): Promise<void> {
    if (this.#running) return;
    this.#running = true;

    this.#reader = this.#input.getReader();
    this.#writer = this.#output.getWriter();

    try {
      while (this.#running) {
        const { done, value } = await this.#reader.read();
        if (done) break;

        this.#buffer += this.#decoder.decode(value);
        this.#processBuffer();
      }
    } catch (error) {
      if (this.#running) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      this.#cleanup();
      this.onclose?.();
    }
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.#writer) {
      throw new Error("Transport not started");
    }

    const data = JSON.stringify(message) + "\n";
    await this.#writer.write(this.#encoder.encode(data));
  }

  close(): Promise<void> {
    this.#running = false;
    this.#cleanup();
    return Promise.resolve();
  }

  #cleanup(): void {
    if (this.#reader) {
      try {
        this.#reader.releaseLock();
      } catch {
        // Ignore release errors
      }
      this.#reader = null;
    }
    if (this.#writer) {
      try {
        this.#writer.releaseLock();
      } catch {
        // Ignore release errors
      }
      this.#writer = null;
    }
  }

  #processBuffer(): void {
    const lines = this.#buffer.split("\n");
    this.#buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as JSONRPCMessage;
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}
