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
export * from "./cdp/mod.ts";

// Convenience exports for common use cases
import { detectOS } from "./os/mod.ts";
import { Browser } from "./browsers/mod.ts";
import { CLI } from "./cli/cli.ts";
import { getProfile, discoverProfiles, getClaudeProfile } from "./profiles/mod.ts";
import { launchBrowser } from "./launcher/mod.ts";
import { connect, connectToPage } from "./cdp/mod.ts";

export {
  Browser,
  // TODO: remove CLI from exports
  CLI,

  detectOS,
  getProfile,
  discoverProfiles,
  getClaudeProfile,
  launchBrowser,
  connect,
  connectToPage,
};
