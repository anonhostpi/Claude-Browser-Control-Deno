/**
 * Browser Types and Interfaces
 */

export type BrowserType = "chrome" | "edge" | "brave" | "chromium" | "vivaldi" | "opera";

export interface BrowserPaths {
  /** Possible executable paths for this browser */
  executables: string[];
  /** User data directory for profiles */
  user_data: string;
}

export interface BrowserInfo {
  type: BrowserType;
  name: string;
  executable: string;
  user_data: string;
  version?: string;
  installed: boolean;
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
