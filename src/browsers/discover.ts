/**
 * Browser Discovery Module
 * Scans the system for installed Chrome-based browsers
 */

import { Browser, IBrowser } from "./browser.ts";
import { Type } from "./metadata.ts";
import { CLI } from "../cli/cli.ts";

/** @deprecated Use Browsers.get */
export async function getBrowser(type: Type): Promise<IBrowser | null> {
  return Browser.get(type);
}

/** @deprecated Use Browsers.getDefault */
export async function getDefaultBrowser(): Promise<IBrowser | null> {
  return Browser.default;
}

/** @deprecated Use Browsers.resolvePath */
export function resolvePath(path: string): string {
  return CLI.expand(path);
}

/** @deprecated Use Browsers.fileExists */
export async function fileExists(path: string): Promise<boolean> {
  return CLI.exists("file", path, true);
}

/** @deprecated Use Browsers.dirExists */
export async function dirExists(path: string): Promise<boolean> {
  return CLI.exists("directory", path, true);
}
