/**
 * Profile Types and Interfaces
 */

export interface ProfileInfo {
  /** Profile directory name (e.g., "Default", "Profile 1", "Claude") */
  name: string;
  /** Full path to the profile directory */
  path: string;
  /** Display name from Preferences file if available */
  displayName?: string;
  /** Whether this is the default profile */
  isDefault: boolean;
}

export interface ProfilePreferences {
  profile?: {
    name?: string;
  };
  account_info?: Array<{
    email?: string;
    full_name?: string;
  }>;
}

export const CLAUDE_PROFILE_NAME = "Claude";
