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
 * Browser Launcher Module
 * Launches Chrome-based browsers with CDP debugging enabled
 * @deprecated
 * @module
 */

import type { LaunchOptions, LaunchedBrowser } from "./types.deprecated.ts";
import { DEFAULT_DEBUGGING_PORT } from "./types.deprecated.ts";
import { CDP } from "../cdp/mod.deprecated.ts";

export class Launcher {
  /** Build command line arguments for browser launch */
  static buildArgs(options: LaunchOptions & { debuggingPort: number }): string[] {
    const {
      profile,
      debuggingPort,
      startUrl,
      headless = false,
      extraArgs = [],
      windowWidth = 1280,
      windowHeight = 800,
    } = options;

    const args: string[] = [
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${profile.path}`,
      `--window-size=${windowWidth},${windowHeight}`,
      "--no-first-run",
      "--no-default-browser-check",
    ];

    if (headless) {
      args.push("--headless=new");
    }

    args.push(...extraArgs);

    if (startUrl) {
      args.push(startUrl);
    }

    return args;
  }

  /** Check if a port is available */
  static isPortAvailable(port: number): boolean {
    try {
      const listener = Deno.listen({ port });
      listener.close();
      return true;
    } catch {
      return false;
    }
  }

  /** Find an available port starting from given port */
  static findPort(startPort: number): number {
    let port = startPort;
    while (!this.isPortAvailable(port)) {
      port++;
      if (port > startPort + 100) {
        throw new Error(`Could not find available port near ${startPort}`);
      }
    }
    return port;
  }

  /** Wait for browser to be ready by polling CDP endpoint */
  static async awaitReady(
    port: number,
    maxAttempts = 30,
    delayMs = 100
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const version = await CDP.Version({ port });
        if (version.webSocketDebuggerUrl) {
          return version.webSocketDebuggerUrl;
        }
      } catch {
        // Browser not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(`Browser did not start within ${maxAttempts * delayMs}ms`);
  }

  /** Launch a browser with CDP debugging enabled */
  static async launch(options: LaunchOptions): Promise<LaunchedBrowser> {
    const { browser, profile } = options;

    const requestedPort = options.debuggingPort ?? DEFAULT_DEBUGGING_PORT;
    const debuggingPort = this.findPort(requestedPort);
    const args = this.buildArgs({ ...options, debuggingPort });

    console.log(`Launching ${browser.name} with profile "${profile.display}"...`);
    console.log(`Executable: ${browser.executable}`);
    console.log(`Debugging port: ${debuggingPort}`);

    const command = new Deno.Command(browser.executable, {
      args,
      stdout: "piped",
      stderr: "piped",
    });

    const process = command.spawn();

    let wsEndpoint: string;
    try {
      wsEndpoint = await this.awaitReady(debuggingPort);
    } catch (error) {
      process.kill();
      throw error;
    }

    console.log(`Browser ready. WebSocket endpoint: ${wsEndpoint}`);

    return {
      process,
      debuggingPort,
      wsEndpoint,
      browser,
      profile,
      close: async () => {
        process.kill();
      },
    };
  }
}

/** @deprecated Use Launcher.launch */
export function launchBrowser(options: LaunchOptions): Promise<LaunchedBrowser> {
  return Launcher.launch(options);
}

/** @deprecated Use Launcher.buildArgs */
export function buildLaunchArgs(options: LaunchOptions): string[] {
  const debuggingPort = options.debuggingPort ?? DEFAULT_DEBUGGING_PORT;
  return Launcher.buildArgs({ ...options, debuggingPort });
}

/** @deprecated Use Launcher.awaitReady */
export function waitForBrowser(
  port: number,
  maxAttempts = 30,
  delayMs = 100
): Promise<string> {
  return Launcher.awaitReady(port, maxAttempts, delayMs);
}

/** @deprecated Use Launcher.findPort */
export function findAvailablePort(startPort: number): number {
  return Launcher.findPort(startPort);
}
