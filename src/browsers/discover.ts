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

  /** Get browser paths for the current platform */
  static getPlatformPaths(config: BrowserConfig, platform: Platform): BrowserPaths {
    return config.paths[platform];
  }

  /** Find the first existing executable from a list of possible paths */
  static async findExecutable(paths: string[]): Promise<string | null> {
    for (const path of paths) {
      const resolved = this.resolvePath(path);
      if (await this.fileExists(resolved)) {
        return resolved;
      }
    }
    return null;
  }

  /** Discover a single browser installation */
  static async #discoverOne(config: BrowserConfig): Promise<BrowserInfo | null> {
    const os = OS.instance;
    const paths = this.getPlatformPaths(config, os.platform);

    const executablePath = await this.findExecutable(paths.executables);
    if (!executablePath) {
      return null;
    }

    const userDataDir = this.resolvePath(paths.userDataDir);

    return {
      type: config.type,
      name: config.name,
      executablePath,
      userDataDir,
      isInstalled: true,
    };
  }

  /** Discover all installed Chrome-based browsers */
  static async discover(): Promise<BrowserInfo[]> {
    const browsers: BrowserInfo[] = [];
    for (const config of BROWSER_CONFIGS) {
      const browser = await this.#discoverOne(config);
      if (browser) {
        browsers.push(browser);
      }
    }
    return browsers;
  }

  /** Get a specific browser by type if installed */
  static async get(type: string): Promise<BrowserInfo | null> {
    const config = BROWSER_CONFIGS.find((c) => c.type === type);
    if (!config) {
      return null;
    }
    return this.#discoverOne(config);
  }

  /** Get the first available browser (prefers Chrome > Edge > Brave > others) */
  static async getDefault(): Promise<BrowserInfo | null> {
    const preferredOrder = ["chrome", "edge", "brave", "chromium", "vivaldi"];
    for (const type of preferredOrder) {
      const browser = await this.get(type);
      if (browser) {
        return browser;
      }
    }
    return null;
  }
}

/** @deprecated Use Browsers.discover */
export function discoverBrowsers(): Promise<BrowserInfo[]> {
  return Browsers.discover();
}

/** @deprecated Use Browsers.get */
export function getBrowser(type: string): Promise<BrowserInfo | null> {
  return Browsers.get(type);
}

/** @deprecated Use Browsers.getDefault */
export function getDefaultBrowser(): Promise<BrowserInfo | null> {
  return Browsers.getDefault();
}

/** @deprecated Use Browsers.resolvePath */
export function resolvePath(path: string): string {
  return Browsers.resolvePath(path);
}

/** @deprecated Use Browsers.fileExists */
export function fileExists(path: string): Promise<boolean> {
  return Browsers.fileExists(path);
}

/** @deprecated Use Browsers.dirExists */
export function dirExists(path: string): Promise<boolean> {
  return Browsers.dirExists(path);
}
