/**
 * Server Start
 * HTTP server with parent PID lifecycle management
 */

import { create as routes } from "./routes/mod.ts";
import { registry } from "./registry.ts";
import { DEFAULT_SERVER_PORT, DEFAULT_SERVER_HOSTNAME } from "./types.ts";
import type { ServerConfig } from "./types.ts";

/** Check if parent process is still alive */
async function isParentAlive(pid: number): Promise<boolean> {
  try {
    // Cross-platform: try to signal process with 0 (doesn't kill, just checks)
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
function startParentMonitor(parentPid: number, onOrphan: () => void): number {
  return setInterval(async () => {
    if (!(await isParentAlive(parentPid))) {
      onOrphan();
    }
  }, 1000);
}

/** Cleanup all instances */
async function cleanup(): Promise<void> {
  const instances = registry.list();
  for (const instance of instances) {
    try {
      await instance.launched.close();
    } catch {
      // Ignore errors during cleanup
    }
  }
}

export async function startServer(config: Partial<ServerConfig> = {}): Promise<void> {
  const {
    port = DEFAULT_SERVER_PORT,
    hostname = DEFAULT_SERVER_HOSTNAME,
    parentPid,
  } = config;

  const app = routes();
  const controller = new AbortController();

  // Parent PID monitoring
  let monitorInterval: number | undefined;
  if (parentPid) {
    console.log(`Monitoring parent PID: ${parentPid}`);
    monitorInterval = startParentMonitor(parentPid, () => {
      console.log("Parent process died, shutting down...");
      controller.abort();
    });
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down server...");
    if (monitorInterval) clearInterval(monitorInterval);
    await cleanup();
    controller.abort();
  };

  Deno.addSignalListener("SIGINT", shutdown);
  if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", shutdown);
  }

  console.log(`Server starting on http://${hostname}:${port}`);

  await Deno.serve({
    port,
    hostname,
    signal: controller.signal,
    onListen: () => {
      console.log(`Server listening on http://${hostname}:${port}`);
    },
  }, app.fetch);
}
