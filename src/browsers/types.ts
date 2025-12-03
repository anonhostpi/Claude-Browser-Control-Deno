/**
 * Browser Types and Interfaces
 */

export type BrowserType = "chrome" | "edge" | "brave" | "chromium" | "vivaldi" | "opera";

export interface BrowserPaths {
  /** Possible executable paths for this browser */
  executables: string[];
  /** User data directory for profiles */
  userDataDir: string;
}

export interface BrowserInfo {
  type: BrowserType;
  name: string;
  executablePath: string;
  userDataDir: string;
  version?: string;
  isInstalled: boolean;
}

export interface BrowserConfig {
  type: BrowserType;
  name: string;
  /** Paths per platform: windows, darwin, linux */
  paths: {
    windows: BrowserPaths;
    darwin: BrowserPaths;
    linux: BrowserPaths;
  };
}
