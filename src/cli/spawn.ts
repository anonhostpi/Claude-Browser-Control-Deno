/**
 * Server Spawner
 * Ensures server is running, spawning if necessary
 */

import { Endpoint } from "../client/mod.ts";

const DEFAULT_SERVER_PORT = 9333;
const DEFAULT_SERVER_HOSTNAME = "127.0.0.1";

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
    while (Date.now() - start < timeout) {
      if (await Endpoint.server.alive())
        return true;
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
    const server = `http://${DEFAULT_SERVER_HOSTNAME}:${port}`;
    Endpoint.configure(server);

    if (await Endpoint.server.alive())
      return { server };

    const process = this.spawn({ port });
    const ready = await this.await(timeout);
    if (!ready) {
      process.kill();
      throw new Error("Server failed to start within timeout");
    }
    return { server, process };
  }
}
