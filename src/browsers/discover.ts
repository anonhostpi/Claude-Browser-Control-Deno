/**
 * Browser Discovery Module
 * Scans the system for installed Chrome-based browsers
 */

import { OS } from "../os/mod.ts";
import { BROWSER_CONFIGS } from "./configs.ts";
import type { BrowserInfo, BrowserConfig, BrowserType } from "./types.ts";
import { CLI } from "../cli/cli.ts";
export class Browser implements BrowserInfo {
  static check(query: BrowserConfig): Browser {
    const os = OS.instance;
    const paths = query.paths[os.platform];
    let exe: string;
    for (const path of paths.executables) {
      if (CLI.exists("file", path, true)) {
        exe = path;
        break;
      }
    }

    const data_dir = CLI.expand(paths.user_data);
    return new Browser({
      type: query.type,
      name: query.name,
      executable: exe!,
      user_data: data_dir,
      installed: CLI.exists("file", exe!, true),
    });
  }

  static discover(): Browser[] {
    const browsers: Browser[] = [];
    for (const config of BROWSER_CONFIGS) {
      const browser = Browser.check(config);
      if (browser.installed)
        browsers.push(browser);
    }
    return browsers;
  }

  static get(type: BrowserType): Browser | null {
    const config = BROWSER_CONFIGS.find((c) => c.type === type);
    if (!config) return null;
    const browser = Browser.check(config);
    return browser.installed ? browser : null;
  }

  static get default(): Browser | null {
    const preference: BrowserType[] = [
      "chrome", "edge", "brave", "chromium", "vivaldi"
    ];
    for (const type of preference) {
      const browser = Browser.get(type);
      if (browser)
        return browser;
    }
    return null;
  }

  constructor(info: BrowserInfo) {
    Object.assign(this, info);
  }
  readonly type!: BrowserType;
  readonly name!: string;
  readonly executable!: string;
  readonly user_data!: string;
  readonly installed!: boolean;
  readonly version?: string;
}

/** @deprecated Use Browsers.discover */
export async function discoverBrowsers(): Promise<BrowserInfo[]> {
  return Browser.discover();
}

/** @deprecated Use Browsers.get */
export async function getBrowser(type: BrowserType): Promise<BrowserInfo | null> {
  return Browser.get(type);
}

/** @deprecated Use Browsers.getDefault */
export async function getDefaultBrowser(): Promise<BrowserInfo | null> {
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
