/**
 * Server Types
 * @module
 */

import type { IBrowser } from "../../browsers/mod.deprecated.ts";
import type { ProfileInfo } from "../../profiles/mod.deprecated.ts";
import type { LaunchedBrowser } from "../../launcher/mod.deprecated.ts";

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
  browser: IBrowser;
  profile: ProfileInfo;
  launched: LaunchedBrowser;
  createdAt: Date;
}

export const DEFAULT_SERVER_PORT = 9333;
export const DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
