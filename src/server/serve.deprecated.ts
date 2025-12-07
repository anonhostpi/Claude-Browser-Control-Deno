/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DEPRECATED - DO NOT USE                                               ║
 * ║                                                                            ║
 * ║  This module is LEGACY code kept for reference only.                       ║
 * ║  Use src/client/ and src/orchestrator/ instead.                            ║
 * ║                                                                            ║
 * ║  Active modules:                                                           ║
 * ║    - src/orchestrator/ (contract-driven REST framework)                    ║
 * ║    - src/client/ (contract-driven browser control client)                  ║
 * ║    - src/cli/ (CLI entry points)                                           ║
 * ║    - src/mcp/ (Model Context Protocol server)                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * Server
 * HTTP server with parent PID lifecycle management
 * @deprecated
 * @module
 */

import { create as routes } from "./routes/mod.deprecated.ts";
import { Hono } from "hono";
import { registry } from "./registry.deprecated.ts";
import { DEFAULT_SERVER_PORT, DEFAULT_SERVER_HOSTNAME } from "./types.deprecated.ts";
import type { ServerConfig } from "./types.deprecated.ts";

export class Server {
  static #instance: Server | null = null;

  static create(config: Partial<ServerConfig> = {}): Server {
    if (this.#instance)
      throw new Error("Server instance is a singleton and already exists.");

    return this.#instance = new Server(config);
  }

  static get instance(): Server {
    if (!this.#instance)
      throw new Error("Server instance is not created yet.");

    return this.#instance;
  }

  readonly port: number;
  readonly hostname: string;
  readonly parent?: number;

  readonly #app: Hono;
  readonly #controller: AbortController;
  #monitorInterval?: number;

  private constructor(config: Partial<ServerConfig> = {}) {
    this.port = config.port ?? DEFAULT_SERVER_PORT;
    this.hostname = config.hostname ?? DEFAULT_SERVER_HOSTNAME;
    this.parent = config.pid;

    this.#app = routes();
    this.#controller = new AbortController();
  }

  /** Check if parent process is still alive */
  async #keepalive(): Promise<boolean> {
    const pid: number = this.parent!;
    try {
      if (Deno.build.os === "windows") {
        const cmd = new Deno.Command("tasklist", {
          args: ["/FI", `PID eq ${pid}`, "/NH"],
          stdout: "piped",
        });
        const output = await cmd.output();
        const text = new TextDecoder().decode(output.stdout);
        return text.includes(pid.toString());
      } else {
        Deno.kill(pid, "SIGCONT");
        return true;
      }
    } catch {
      return false;
    }
  }

  /** Start parent PID monitor */
  #monitor(): void {
    if (!this.parent) return;

    console.log(`Monitoring parent PID: ${this.parent}`);
    this.#monitorInterval = setInterval(async () => {
      if (!(await this.#keepalive())) {
        console.log("Parent process died, shutting down...");
        this.#controller.abort();
      }
    }, 1000);
  }

  /** Cleanup all browser instances */
  async #cleanup(): Promise<void> {
    const instances = registry.list();
    for (const instance of instances) {
      try {
        await instance.launched.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
  }

  /** Graceful shutdown */
  async shutdown(): Promise<void> {
    console.log("\nShutting down server...");
    if (this.#monitorInterval) clearInterval(this.#monitorInterval);
    await this.#cleanup();
    this.#controller.abort();
  }

  /** Start the server */
  async start(): Promise<void> {
    this.#monitor();

    Deno.addSignalListener("SIGINT", () => this.shutdown());
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGTERM", () => this.shutdown());
    }

    // TODO: JSON-ify all console.log calls
    console.log(`Server starting on http://${this.hostname}:${this.port}`);

    await Deno.serve({
      port: this.port,
      hostname: this.hostname,
      signal: this.#controller.signal,
      onListen: () => {
        console.log(`Server listening on http://${this.hostname}:${this.port}`);
      },
    }, this.#app.fetch);
  }
}
