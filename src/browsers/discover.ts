/**
 * Browser Discovery Module
 * Scans the system for installed Chrome-based browsers
 */

import { OS, type Platform } from "../os/mod.ts";
import { BROWSER_CONFIGS } from "./configs.ts";
import type { BrowserInfo, BrowserConfig, BrowserPaths } from "./types.ts";

export class Browsers {
  /** Resolve environment variables in a path string */
  static resolvePath(path: string): string {
    return path.replace(/\$\{(\w+)\}/g, (_, varName) => {
      return Deno.env.get(varName) ?? "";
    });
  }

  /** Check if a file exists at the given path */
  static async fileExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /** Check if a directory exists at the given path */
  static async dirExists(path: string): Promise<boolean> {
    try {
      const stat = await Deno.stat(path);
      return stat.isDirectory;
    } catch {
      return false;
    }
  }
}

/**
 * Resolves environment variables in a path string
 */
function resolvePath(path: string): string {
  return path.replace(/\$\{(\w+)\}/g, (_, varName) => {
    return Deno.env.get(varName) ?? "";
  });
}

/**
 * Checks if a file exists at the given path
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch {
    return false;
  }
}

/**
 * Checks if a directory exists at the given path
 */
async function dirExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isDirectory;
  } catch {
    return false;
  }
}

/**
 * Gets the browser paths for the current platform
 */
function getPlatformPaths(config: BrowserConfig, platform: Platform): BrowserPaths {
  return config.paths[platform];
}

/**
 * Finds the first existing executable from a list of possible paths
 */
async function findExecutable(paths: string[]): Promise<string | null> {
  for (const path of paths) {
    const resolved = resolvePath(path);
    if (await fileExists(resolved)) {
      return resolved;
    }
  }
  return null;
}

/**
 * Discovers a single browser installation
 */
async function discoverBrowser(config: BrowserConfig): Promise<BrowserInfo | null> {
  const os = OS.instance;
  const paths = getPlatformPaths(config, os.platform);
  
  const executablePath = await findExecutable(paths.executables);
  if (!executablePath) {
    return null;
  }

  const userDataDir = resolvePath(paths.userDataDir);
  const userDataExists = await dirExists(userDataDir);

  return {
    type: config.type,
    name: config.name,
    executablePath,
    userDataDir,
    isInstalled: true,
  };
}

/**
 * Discovers all installed Chrome-based browsers on the system
 */
export async function discoverBrowsers(): Promise<BrowserInfo[]> {
  const browsers: BrowserInfo[] = [];

  for (const config of BROWSER_CONFIGS) {
    const browser = await discoverBrowser(config);
    if (browser) {
      browsers.push(browser);
    }
  }

  return browsers;
}

/**
 * Gets a specific browser by type if installed
 */
export async function getBrowser(type: string): Promise<BrowserInfo | null> {
  const config = BROWSER_CONFIGS.find((c) => c.type === type);
  if (!config) {
    return null;
  }
  return discoverBrowser(config);
}

/**
 * Gets the first available browser, preferring Chrome > Edge > Brave > others
 */
export async function getDefaultBrowser(): Promise<BrowserInfo | null> {
  const preferredOrder = ["chrome", "edge", "brave", "chromium", "vivaldi"];
  
  for (const type of preferredOrder) {
    const browser = await getBrowser(type);
    if (browser) {
      return browser;
    }
  }
  
  return null;
}

export { resolvePath, fileExists, dirExists };
