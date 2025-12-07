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
 * Instance Registry
 * Tracks running browser instances
 * @deprecated
 * @module
 */

import type { Instance, InstanceKey } from "./types.deprecated.ts";

/** Creates a string key from browser + profile */
function toKey(key: InstanceKey): string {
  return `${key.browser}:${key.profile}`;
}

class InstanceRegistry {
  private instances = new Map<string, Instance>();

  get(key: InstanceKey): Instance | undefined {
    return this.instances.get(toKey(key));
  }

  set(instance: Instance): void {
    this.instances.set(toKey(instance.key), instance);
  }

  delete(key: InstanceKey): boolean {
    return this.instances.delete(toKey(key));
  }

  has(key: InstanceKey): boolean {
    return this.instances.has(toKey(key));
  }

  list(): Instance[] {
    return Array.from(this.instances.values());
  }

  listByBrowser(browser: string): Instance[] {
    return this.list().filter((i) => i.key.browser === browser);
  }
}

/** Global instance registry */
export const registry = new InstanceRegistry();
