/**
 * Profile Discovery Module
 * Discovers and manages browser profiles
 */

import { join } from "https://deno.land/std@0.224.0/path/mod.ts";
import type { BrowserInfo } from "../browsers/mod.ts";
import type { ProfileInfo, ProfilePreferences } from "./types.ts";
import { CLAUDE_PROFILE_NAME } from "./types.ts";

export class Profiles {
  /** Read the Preferences file from a profile directory */
  static async readPreferences(profilePath: string): Promise<ProfilePreferences | null> {
    try {
      const prefsPath = join(profilePath, "Preferences");
      const content = await Deno.readTextFile(prefsPath);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /** Check if a directory is a valid Chrome profile */
  static async isValid(path: string): Promise<boolean> {
    try {
      const prefsPath = join(path, "Preferences");
      const stat = await Deno.stat(prefsPath);
      return stat.isFile;
    } catch {
      return false;
    }
  }

  /** Discover all profiles for a given browser */
  static async discover(browser: BrowserInfo): Promise<ProfileInfo[]> {
    const profiles: ProfileInfo[] = [];
    const userDataDir = browser.userDataDir;

    try {
      for await (const entry of Deno.readDir(userDataDir)) {
        if (!entry.isDirectory) continue;

        const isProfileDir =
          entry.name === "Default" ||
          entry.name.startsWith("Profile ") ||
          entry.name === CLAUDE_PROFILE_NAME;

        const profilePath = join(userDataDir, entry.name);

        if (isProfileDir || (await this.isValid(profilePath))) {
          const prefs = await this.readPreferences(profilePath);

          profiles.push({
            name: entry.name,
            path: profilePath,
            displayName: prefs?.profile?.name ?? entry.name,
            isDefault: entry.name === "Default",
          });
        }
      }
    } catch (error) {
      console.error(`Error reading profiles from ${userDataDir}:`, error);
    }

    return profiles;
  }

  /** Find a specific profile by name */
  static async find(browser: BrowserInfo, profileName: string): Promise<ProfileInfo | null> {
    const profiles = await this.discover(browser);
    return (
      profiles.find((p) => p.name === profileName || p.displayName === profileName) ?? null
    );
  }
}

/**
 * Reads the Preferences file from a profile directory
 */
async function readProfilePreferences(
  profilePath: string
): Promise<ProfilePreferences | null> {
  try {
    const prefsPath = join(profilePath, "Preferences");
    const content = await Deno.readTextFile(prefsPath);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Checks if a directory is a valid Chrome profile
 */
async function isValidProfile(path: string): Promise<boolean> {
  try {
    // A valid profile has a Preferences file
    const prefsPath = join(path, "Preferences");
    const stat = await Deno.stat(prefsPath);
    return stat.isFile;
  } catch {
    return false;
  }
}

/**
 * Discovers all profiles for a given browser
 */
export async function discoverProfiles(browser: BrowserInfo): Promise<ProfileInfo[]> {
  const profiles: ProfileInfo[] = [];
  const userDataDir = browser.userDataDir;

  try {
    for await (const entry of Deno.readDir(userDataDir)) {
      if (!entry.isDirectory) continue;
      
      // Profile directories are "Default", "Profile 1", "Profile 2", etc.
      // Or custom named profiles
      const isProfileDir = 
        entry.name === "Default" || 
        entry.name.startsWith("Profile ") ||
        entry.name === CLAUDE_PROFILE_NAME;

      // Also check for any directory that contains a Preferences file
      const profilePath = join(userDataDir, entry.name);
      
      if (isProfileDir || await isValidProfile(profilePath)) {
        const prefs = await readProfilePreferences(profilePath);
        
        profiles.push({
          name: entry.name,
          path: profilePath,
          displayName: prefs?.profile?.name ?? entry.name,
          isDefault: entry.name === "Default",
        });
      }
    }
  } catch (error) {
    console.error(`Error reading profiles from ${userDataDir}:`, error);
  }

  return profiles;
}

/**
 * Finds a specific profile by name
 */
export async function findProfile(
  browser: BrowserInfo,
  profileName: string
): Promise<ProfileInfo | null> {
  const profiles = await discoverProfiles(browser);
  return profiles.find((p) => 
    p.name === profileName || p.displayName === profileName
  ) ?? null;
}

/**
 * Gets or creates the Claude profile directory
 * Returns the profile path (creates directory if needed)
 */
export async function getClaudeProfile(browser: BrowserInfo): Promise<ProfileInfo> {
  const userDataDir = browser.userDataDir;
  const claudeProfilePath = join(userDataDir, CLAUDE_PROFILE_NAME);

  // Check if Claude profile already exists
  const existingProfile = await findProfile(browser, CLAUDE_PROFILE_NAME);
  if (existingProfile) {
    return existingProfile;
  }

  // Create the Claude profile directory
  try {
    await Deno.mkdir(claudeProfilePath, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error;
    }
  }

  return {
    name: CLAUDE_PROFILE_NAME,
    path: claudeProfilePath,
    displayName: CLAUDE_PROFILE_NAME,
    isDefault: false,
  };
}

/**
 * Gets the appropriate profile - Claude profile by default, or specified profile
 */
export async function getProfile(
  browser: BrowserInfo,
  profileName?: string
): Promise<ProfileInfo> {
  if (profileName) {
    const profile = await findProfile(browser, profileName);
    if (!profile) {
      throw new Error(`Profile "${profileName}" not found for ${browser.name}`);
    }
    return profile;
  }
  
  // Default to Claude profile
  return getClaudeProfile(browser);
}
