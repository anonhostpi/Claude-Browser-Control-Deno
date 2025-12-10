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
export const DEFAULT_SERVER_URL = `http://${DEFAULT_SERVER_HOSTNAME}:${DEFAULT_SERVER_PORT}`;

export function ensure_url(url: string = DEFAULT_SERVER_URL): [string, URL] {
  try {
    try {
      return [url, new URL(url)];
    } catch {
      return [`http://${url}`, new URL(`http://${url}`)];
    }
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}
