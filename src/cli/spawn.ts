/**
 * Server Spawner
 * Ensures server is running, spawning if necessary
 */

import { Root } from "../client/mod.ts";
import { DEFAULT_SERVER_HOSTNAME, DEFAULT_SERVER_PORT } from "../orchestrator/server/types.ts";

export interface SpawnOptions {
  port?: number;
  timeout?: number;
}

export class Controller {
  static #instance: Controller | null = null;
  static create(directory: string): Controller {
    if (this.#instance)
      throw new Error("Controller instance is a singleton and already exists.");

    return this.#instance ??= new Controller(directory);
  }
  static get instance(): Controller {
    if (!this.#instance)
      throw new Error("Controller instance is not created yet.");

    return this.#instance;
  }
  private constructor(directory: string) {
    this.directory = directory;
  }
  readonly directory: string;

  #serverUrl: string = `http://${DEFAULT_SERVER_HOSTNAME}:${DEFAULT_SERVER_PORT}`;

  spawn(
    { port = DEFAULT_SERVER_PORT }: SpawnOptions,
    pid: number = Deno.pid,
  ): Deno.ChildProcess {
    const project_dir = this.directory;
    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-env",
        "--allow-net",
        "--allow-run",
        `${project_dir}/main.ts`,
        "serve",
        `--port=${port}`,
        `--parent-pid=${pid}`,
      ],
      stdout: "inherit",
      stderr: "inherit",
      stdin: "null",
    });

    return cmd.spawn();
  }

  async await(timeout: number): Promise<boolean> {
    const start = Date.now();
    const root = new Root(this.#serverUrl);
    while (Date.now() - start < timeout) {
      if (await root.health()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  async ensure(
    { port = DEFAULT_SERVER_PORT, timeout = 5000 }: SpawnOptions = {}
  ): Promise<{
    server: string;
    process?: Deno.ChildProcess;
  }> {
    this.#serverUrl = `http://${DEFAULT_SERVER_HOSTNAME}:${port}`;
    const root = new Root(this.#serverUrl);

    if (await root.health()) return { server: this.#serverUrl };

    const process = this.spawn({ port });
    const ready = await this.await(timeout);
    if (!ready) {
      process.kill();
      throw new Error("Server failed to start within timeout");
    }
    return { server: this.#serverUrl, process };
  }
}
