/**
 * Instance Registry
 * Tracks running browser instances
 * @module
 */

import type { Instance, InstanceKey } from "./types.ts";

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
