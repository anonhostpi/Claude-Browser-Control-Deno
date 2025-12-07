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
 * CDP Module Exports
 * @deprecated
 * @module
 */

import { default as Original } from "chrome-remote-interface";

export type CDP = typeof Original & {
  WithPage(options?: Original.Options): Promise<Original.Client>;
}
export const CDP: CDP = Object.assign(Original, {
  WithPage(options?: Original.Options): Promise<Original.Client> {
    return Original(Object.assign({}, options, {
      target: (targets: Original.Target[]) => {
        const page = targets.find((t) => t.type === "page");
        if (!page) throw new Error("No page target found");
        return page;
      }
    }))
  }
});
