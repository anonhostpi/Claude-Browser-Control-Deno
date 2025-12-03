/**
 * CDP Version Helper
 * Get browser version information
 */

import CDP from "chrome-remote-interface";
import type { CDPVersion } from "./types.ts";

/**
 * Gets version information from a running browser
 */
export async function getVersion(
  options: { host?: string; port?: number } = {}
): Promise<CDPVersion> {
  const { host = "127.0.0.1", port = 9222 } = options;
  return await CDP.Version({ host, port }) as CDPVersion;
}
