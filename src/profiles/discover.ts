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
    const userDataDir = browser.user_data;

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

  /** Get or create the Claude profile directory */
  static async getClaude(browser: BrowserInfo): Promise<ProfileInfo> {
    const userDataDir = browser.user_data;
    const claudeProfilePath = join(userDataDir, CLAUDE_PROFILE_NAME);

    const existingProfile = await this.find(browser, CLAUDE_PROFILE_NAME);
    if (existingProfile) {
      return existingProfile;
    }

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

  /** Get the appropriate profile - Claude profile by default, or specified profile */
  static async get(browser: BrowserInfo, profileName?: string): Promise<ProfileInfo> {
    if (profileName) {
      const profile = await this.find(browser, profileName);
      if (!profile) {
        throw new Error(`Profile "${profileName}" not found for ${browser.name}`);
      }
      return profile;
    }

    return this.getClaude(browser);
  }
}

/** @deprecated Use Profiles.discover */
export function discoverProfiles(browser: BrowserInfo): Promise<ProfileInfo[]> {
  return Profiles.discover(browser);
}

/** @deprecated Use Profiles.find */
export function findProfile(
  browser: BrowserInfo,
  profileName: string
): Promise<ProfileInfo | null> {
  return Profiles.find(browser, profileName);
}

/** @deprecated Use Profiles.getClaude */
export function getClaudeProfile(browser: BrowserInfo): Promise<ProfileInfo> {
  return Profiles.getClaude(browser);
}

/** @deprecated Use Profiles.get */
export function getProfile(
  browser: BrowserInfo,
  profileName?: string
): Promise<ProfileInfo> {
  return Profiles.get(browser, profileName);
}
