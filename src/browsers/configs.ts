/**
 * Browser Path Configurations
 * Defines executable and user data paths for each supported browser on each OS
 */

import type { BrowserConfig } from "./types.ts";

// Helper to construct Windows paths
const winProgFiles = "C:\\Program Files";
const winProgFiles86 = "C:\\Program Files (x86)";
const winLocalAppData = "${LOCALAPPDATA}"; // Will be resolved at runtime

export const BROWSER_CONFIGS: BrowserConfig[] = [
  {
    type: "chrome",
    name: "Google Chrome",
    paths: {
      windows: {
        executables: [
          `${winProgFiles}\\Google\\Chrome\\Application\\chrome.exe`,
          `${winProgFiles86}\\Google\\Chrome\\Application\\chrome.exe`,
        ],
        userDataDir: `${winLocalAppData}\\Google\\Chrome\\User Data`,
      },
      darwin: {
        executables: [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ],
        userDataDir: "${HOME}/Library/Application Support/Google/Chrome",
      },
      linux: {
        executables: [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/opt/google/chrome/chrome",
        ],
        userDataDir: "${HOME}/.config/google-chrome",
      },
    },
  },
  {
    type: "edge",
    name: "Microsoft Edge",
    paths: {
      windows: {
        executables: [
          `${winProgFiles86}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${winProgFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ],
        userDataDir: `${winLocalAppData}\\Microsoft\\Edge\\User Data`,
      },
      darwin: {
        executables: [
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ],
        userDataDir: "${HOME}/Library/Application Support/Microsoft Edge",
      },
      linux: {
        executables: [
          "/usr/bin/microsoft-edge",
          "/usr/bin/microsoft-edge-stable",
        ],
        userDataDir: "${HOME}/.config/microsoft-edge",
      },
    },
  },
  {
    type: "brave",
    name: "Brave Browser",
    paths: {
      windows: {
        executables: [
          `${winProgFiles}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
          `${winProgFiles86}\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
        ],
        userDataDir: `${winLocalAppData}\\BraveSoftware\\Brave-Browser\\User Data`,
      },
      darwin: {
        executables: [
          "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ],
        userDataDir: "${HOME}/Library/Application Support/BraveSoftware/Brave-Browser",
      },
      linux: {
        executables: [
          "/usr/bin/brave-browser",
          "/usr/bin/brave",
        ],
        userDataDir: "${HOME}/.config/BraveSoftware/Brave-Browser",
      },
    },
  },
  {
    type: "chromium",
    name: "Chromium",
    paths: {
      windows: {
        executables: [
          `${winProgFiles}\\Chromium\\Application\\chrome.exe`,
          `${winLocalAppData}\\Chromium\\Application\\chrome.exe`,
        ],
        userDataDir: `${winLocalAppData}\\Chromium\\User Data`,
      },
      darwin: {
        executables: [
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ],
        userDataDir: "${HOME}/Library/Application Support/Chromium",
      },
      linux: {
        executables: [
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/snap/bin/chromium",
        ],
        userDataDir: "${HOME}/.config/chromium",
      },
    },
  },
  {
    type: "vivaldi",
    name: "Vivaldi",
    paths: {
      windows: {
        executables: [
          `${winLocalAppData}\\Vivaldi\\Application\\vivaldi.exe`,
          `${winProgFiles}\\Vivaldi\\Application\\vivaldi.exe`,
        ],
        userDataDir: `${winLocalAppData}\\Vivaldi\\User Data`,
      },
      darwin: {
        executables: [
          "/Applications/Vivaldi.app/Contents/MacOS/Vivaldi",
        ],
        userDataDir: "${HOME}/Library/Application Support/Vivaldi",
      },
      linux: {
        executables: [
          "/usr/bin/vivaldi",
          "/usr/bin/vivaldi-stable",
        ],
        userDataDir: "${HOME}/.config/vivaldi",
      },
    },
  },
];
