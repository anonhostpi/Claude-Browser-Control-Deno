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

/** @deprecated Use Targets.create */
export function createTarget(
  url: string = "about:blank",
  options: TargetOptions = {}
): Promise<CDPTarget> {
  return Targets.create(url, options);
}

/** @deprecated Use Targets.activate */
export function activateTarget(
  id: string,
  options: TargetOptions = {}
): Promise<void> {
  return Targets.activate(id, options);
}

/** @deprecated Use Targets.close */
export function closeTarget(
  id: string,
  options: TargetOptions = {}
): Promise<void> {
  return Targets.close(id, options);
}
