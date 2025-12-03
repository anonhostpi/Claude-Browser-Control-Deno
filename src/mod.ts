/**
 * Claude Browser Control for Deno
 * 
 * A library for controlling Chrome-based browsers via CDP
 */

// Re-export all modules
export * from "./os/mod.ts";
export * from "./browsers/mod.ts";
export * from "./profiles/mod.ts";
export * from "./launcher/mod.ts";

// Convenience exports for common use cases
import { detectOS } from "./os/mod.ts";
import { discoverBrowsers, getDefaultBrowser, getBrowser } from "./browsers/mod.ts";
import { getProfile, discoverProfiles, getClaudeProfile } from "./profiles/mod.ts";
import { launchBrowser } from "./launcher/mod.ts";

export {
  detectOS,
  discoverBrowsers,
  getDefaultBrowser,
  getBrowser,
  getProfile,
  discoverProfiles,
  getClaudeProfile,
  launchBrowser,
};
