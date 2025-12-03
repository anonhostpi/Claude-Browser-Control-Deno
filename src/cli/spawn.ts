/**
 * Server Spawner
 * Ensures server is running, spawning if necessary
 */

import { Client } from "./client.ts";
import { DEFAULT_SERVER_PORT } from "../server/mod.ts";

export interface SpawnOptions {
  port?: number;
  timeout?: number;
}

/** Spawn the server as a child process */
async function spawnServer(port: number, parentPid: number): Promise<Deno.ChildProcess> {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-net",
      "--allow-run",
      "main.ts",
      "serve",
      `--port=${port}`,
      `--parent-pid=${parentPid}`,
    ],
    stdout: "inherit",
    stderr: "inherit",
    stdin: "null",
  });

  return cmd.spawn();
}

/** Wait for server to be ready */
async function waitForServer(client: Client, timeout: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await client.isAlive()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

/** Ensure server is running, returns client and whether we spawned it */
export async function ensureServer(
  options: SpawnOptions = {}
): Promise<{ client: Client; spawned: boolean; process?: Deno.ChildProcess }> {
  const { port = DEFAULT_SERVER_PORT, timeout = 5000 } = options;
  const client = new Client({ port });

  // Check if already running
  if (await client.isAlive()) {
    return { client, spawned: false };
  }

  // Spawn server
  const process = await spawnServer(port, Deno.pid);

  // Wait for it to be ready
  const ready = await waitForServer(client, timeout);
  if (!ready) {
    process.kill();
    throw new Error("Server failed to start within timeout");
  }

  return { client, spawned: true, process };
}
