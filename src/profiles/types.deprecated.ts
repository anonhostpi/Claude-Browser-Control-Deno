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
 * Profile Types and Interfaces
 * @deprecated
 * @module
 */

export interface ProfileInfo {
  /** Profile directory name (e.g., "Default", "Profile 1", "Claude") */
  name: string;
  /** Full path to the profile directory */
  path: string;
  /** Display name from Preferences file if available */
  display?: string;
  /** Whether this is the default profile */
  isDefault: boolean;
}

export interface ProfilePreferences {
  profile?: {
    name?: string;
  };
  account_info?: Array<{
    email?: string;
    full_name?: string;
  }>;
}

export const CLAUDE_PROFILE_NAME = "Claude";
