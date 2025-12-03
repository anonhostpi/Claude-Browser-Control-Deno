/**
 * CDP Client
 * Wrapper around chrome-remote-interface for browser control
 */

import CDP from "chrome-remote-interface";
import type { CDPConnectionOptions, CDPTarget } from "./types.ts";

// Re-export the CDP client type
export type CDPClient = Awaited<ReturnType<typeof CDP>>;

/**
 * Connects to a browser target via CDP
 */
export async function connect(
  options: CDPConnectionOptions = {}
): Promise<CDPClient> {
  const {
    host = "127.0.0.1",
    port = 9222,
    secure = false,
    target,
  } = options;

  return await CDP({ host, port, secure, target });
}

/**
 * Connects to the first available page target
 */
export async function connectToPage(
  options: { host?: string; port?: number } = {}
): Promise<CDPClient> {
  return await connect({
    ...options,
    target: (targets: CDPTarget[]) => {
      const page = targets.find((t) => t.type === "page");
      if (!page) throw new Error("No page target found");
      return page;
    },
  });
}
