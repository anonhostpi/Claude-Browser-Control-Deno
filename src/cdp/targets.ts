/**
 * CDP Target Management
 * List, create, activate, and close browser targets
 */

import CDP from "chrome-remote-interface";
import type { CDPTarget } from "./types.ts";

/**
 * Lists all available targets
 */
export async function listTargets(
  options: { host?: string; port?: number } = {}
): Promise<CDPTarget[]> {
  const { host = "127.0.0.1", port = 9222 } = options;
  return await CDP.List({ host, port }) as CDPTarget[];
}

/**
 * Creates a new target (tab)
 */
export async function createTarget(
  url: string = "about:blank",
  options: { host?: string; port?: number } = {}
): Promise<CDPTarget> {
  const { host = "127.0.0.1", port = 9222 } = options;
  return await CDP.New({ host, port, url }) as CDPTarget;
}

/**
 * Activates a target by ID
 */
export async function activateTarget(
  id: string,
  options: { host?: string; port?: number } = {}
): Promise<void> {
  const { host = "127.0.0.1", port = 9222 } = options;
  await CDP.Activate({ host, port, id });
}

/**
 * Closes a target by ID
 */
export async function closeTarget(
  id: string,
  options: { host?: string; port?: number } = {}
): Promise<void> {
  const { host = "127.0.0.1", port = 9222 } = options;
  await CDP.Close({ host, port, id });
}
