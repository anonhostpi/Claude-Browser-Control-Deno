/**
 * Server
 * HTTP server with parent PID lifecycle management
 * @module
 */

import { Hono } from "hono";
import { build } from "./builder.ts";
import { contracts } from "../contracts/api.ts";
import { registry } from "./registry.ts";
import { DEFAULT_SERVER_PORT, DEFAULT_SERVER_HOSTNAME } from "./types.ts";
import type { ServerConfig } from "./types.ts";

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

  #app?: Hono;
  readonly #controller: AbortController;
  #monitorInterval?: number;

  private constructor(config: Partial<ServerConfig> = {}) {
    this.port = config.port ?? DEFAULT_SERVER_PORT;
    this.hostname = config.hostname ?? DEFAULT_SERVER_HOSTNAME;
    this.parent = config.pid;

    this.#controller = new AbortController();
  }

  /** Build routes from contracts */
  async #buildRoutes(): Promise<Hono> {
    // Get the project root for module resolution
    const base = new URL("../../../", import.meta.url).href;
    return await build([...contracts], base);
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
    // Build routes from contracts
    this.#app = await this.#buildRoutes();

    this.#monitor();

    Deno.addSignalListener("SIGINT", () => this.shutdown());
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGTERM", () => this.shutdown());
    }

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
