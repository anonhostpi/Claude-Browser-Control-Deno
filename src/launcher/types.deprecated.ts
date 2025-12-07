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
 * Launcher Types
 * @deprecated
 * @module
 */

import type { IBrowser } from "../browsers/mod.deprecated.ts";
import type { ProfileInfo } from "../profiles/mod.deprecated.ts";

export interface LaunchOptions {
  /** Browser to launch */
  browser: IBrowser;
  /** Profile to use */
  profile: ProfileInfo;
  /** Port for Chrome DevTools Protocol */
  debuggingPort?: number;
  /** Start with a specific URL */
  startUrl?: string;
  /** Run in headless mode */
  headless?: boolean;
  /** Additional Chrome flags */
  extraArgs?: string[];
  /** Window width */
  windowWidth?: number;
  /** Window height */
  windowHeight?: number;
}

export interface LaunchedBrowser {
  /** The Deno process */
  process: Deno.ChildProcess;
  /** CDP debugging port */
  debuggingPort: number;
  /** WebSocket URL for CDP connection */
  wsEndpoint: string;
  /** Browser info */
  browser: IBrowser;
  /** Profile info */
  profile: ProfileInfo;
  /** Kill the browser process */
  close: () => Promise<void>;
}

export const DEFAULT_DEBUGGING_PORT = 9222;
