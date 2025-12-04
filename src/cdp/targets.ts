/**
 * CDP Target Management
 * List, create, activate, and close browser targets
 */

import CDP from "chrome-remote-interface";
import type { CDPTarget } from "./types.ts";

export interface TargetOptions {
  host?: string;
  port?: number;
}

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9222;

export class Targets {
  /** List all available targets */
  static async list(options: TargetOptions = {}): Promise<CDPTarget[]> {
    const { host = DEFAULT_HOST, port = DEFAULT_PORT } = options;
    return await CDP.List({ host, port }) as CDPTarget[];
  }

  /** Create a new target (tab) */
  static async create(
    url: string = "about:blank",
    options: TargetOptions = {}
  ): Promise<CDPTarget> {
    const { host = DEFAULT_HOST, port = DEFAULT_PORT } = options;
    return await CDP.New({ host, port, url }) as CDPTarget;
  }

  /** Activate a target by ID */
  static async activate(id: string, options: TargetOptions = {}): Promise<void> {
    const { host = DEFAULT_HOST, port = DEFAULT_PORT } = options;
    await CDP.Activate({ host, port, id });
  }

  /** Close a target by ID */
  static async close(id: string, options: TargetOptions = {}): Promise<void> {
    const { host = DEFAULT_HOST, port = DEFAULT_PORT } = options;
    await CDP.Close({ host, port, id });
  }
}

/** @deprecated Use Targets.list */
export function listTargets(
  options: TargetOptions = {}
): Promise<CDPTarget[]> {
  return Targets.list(options);
}

/**
 * Creates a new target (tab)
 */
export async function createTarget(
  url: string = "about:blank",
  options: { host?: string; port?: number } = {}
): Promise<CDPTarget> {
  const { host = "127.0.0.1", port = 9222 } = options;
  return await CDP.New({ host, port, url }) as CDPTarget;
}

/**
 * Activates a target by ID
 */
export async function activateTarget(
  id: string,
  options: { host?: string; port?: number } = {}
): Promise<void> {
  const { host = "127.0.0.1", port = 9222 } = options;
  await CDP.Activate({ host, port, id });
}

/**
 * Closes a target by ID
 */
export async function closeTarget(
  id: string,
  options: { host?: string; port?: number } = {}
): Promise<void> {
  const { host = "127.0.0.1", port = 9222 } = options;
  await CDP.Close({ host, port, id });
}
