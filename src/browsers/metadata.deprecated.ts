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
 * @deprecated
 * @module
 */

export type Type =
  "chrome" | "edge" | "brave" | "chromium" | "vivaldi" | "opera";

export type Paths = {
  /** Possible executable paths for this browser */
  executables: string[];
  /** User data directory for profiles */
  user_data: string;
}

export type Config = {
  type: Type;
  name: string;
  paths: {
    windows: Paths;
    darwin: Paths;
    linux: Paths;
  }
}