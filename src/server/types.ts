/**
 * Server Types
 */

import type { BrowserInfo } from "../browsers/mod.ts";
import type { ProfileInfo } from "../profiles/mod.ts";
import type { LaunchedBrowser } from "../launcher/mod.ts";

/** Server configuration */
export interface ServerConfig {
  port: number;
  hostname: string;
  /** Parent PID - server exits when parent dies (CLI-spawned mode) */
  pid?: number;
}

/** Key for instance registry */
export interface InstanceKey {
  browser: string;
  profile: string;
}

/** Running browser instance */
export interface Instance {
  key: InstanceKey;
  browser: BrowserInfo;
  profile: ProfileInfo;
  launched: LaunchedBrowser;
  createdAt: Date;
}

export const DEFAULT_SERVER_PORT = 9333;
export const DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
