/**
 * Server Types
 * @module
 */

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

/** Running browser instance - simplified for new architecture */
export interface Instance {
  key: InstanceKey;
  port: number;
  wsEndpoint: string;
  createdAt: Date;
  close: () => Promise<void>;
}

export const DEFAULT_SERVER_PORT = 9333;
export const DEFAULT_SERVER_HOSTNAME = "127.0.0.1";
