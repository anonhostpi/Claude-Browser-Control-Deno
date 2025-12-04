/**
 * Browser Launcher Module
 * Launches Chrome-based browsers with CDP debugging enabled
 */

import type { LaunchOptions, LaunchedBrowser } from "./types.ts";
import { DEFAULT_DEBUGGING_PORT } from "./types.ts";
import { getVersion } from "../cdp/mod.ts";

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
}

/** @deprecated Use Launcher.buildArgs */
function buildLaunchArgs(options: LaunchOptions): string[] {
  const debuggingPort = options.debuggingPort ?? DEFAULT_DEBUGGING_PORT;
  return Launcher.buildArgs({ ...options, debuggingPort });
}

/**
 * Waits for the browser to be ready by polling the CDP endpoint
 */
async function waitForBrowser(
  port: number,
  maxAttempts = 30,
  delayMs = 100
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const version = await getVersion({ port });
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

/**
 * Checks if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    const listener = Deno.listen({ port });
    listener.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds an available port starting from the given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > startPort + 100) {
      throw new Error(`Could not find available port near ${startPort}`);
    }
  }
  return port;
}

/**
 * Launches a browser with CDP debugging enabled
 */
export async function launchBrowser(
  options: LaunchOptions
): Promise<LaunchedBrowser> {
  const { browser, profile } = options;
  
  // Find an available debugging port
  const requestedPort = options.debuggingPort ?? DEFAULT_DEBUGGING_PORT;
  const debuggingPort = await findAvailablePort(requestedPort);

  const args = buildLaunchArgs({ ...options, debuggingPort });

  console.log(`Launching ${browser.name} with profile "${profile.displayName}"...`);
  console.log(`Executable: ${browser.executablePath}`);
  console.log(`Debugging port: ${debuggingPort}`);

  // Launch the browser process
  const command = new Deno.Command(browser.executablePath, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const process = command.spawn();

  // Wait for browser to be ready and get WebSocket endpoint
  let wsEndpoint: string;
  try {
    wsEndpoint = await waitForBrowser(debuggingPort);
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
      try {
        process.kill();
      } catch {
        // Process may have already exited
      }
    },
  };
}

export { buildLaunchArgs, waitForBrowser, findAvailablePort };
