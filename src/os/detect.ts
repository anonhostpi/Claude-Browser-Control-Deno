/**
 * OS Detection Module
 * Identifies the host operating system and provides platform-specific paths
 */

export type Platform = "windows" | "darwin" | "linux";
export type DenoOS = typeof Deno.build.os;

export interface OSInfo {
  platform: Platform;
  homeDir: string;
  localAppData?: string; // Windows-specific
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
}

/**
 * Maps Deno's OS to our supported platform types
 * Unsupported Unix-like OSes are mapped to "linux"
 */
function mapPlatform(os: DenoOS): Platform {
  if (os === "windows") return "windows";
  if (os === "darwin") return "darwin";
  return "linux"; // FreeBSD, NetBSD, etc. use Linux-like paths
}

/**
 * Detects the current operating system and returns relevant info
 */
export function detectOS(): OSInfo {
  const rawPlatform = Deno.build.os;
  const platform = mapPlatform(rawPlatform);
  const homeDir = getHomeDir();

  const isWindows = platform === "windows";
  const isMac = platform === "darwin";
  const isLinux = platform === "linux";

  return {
    platform,
    homeDir,
    localAppData: isWindows ? Deno.env.get("LOCALAPPDATA") : undefined,
    isWindows,
    isMac,
    isLinux,
  };
}

/**
 * Gets the user's home directory
 */
export function getHomeDir(): string {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
  if (!home) {
    throw new Error("Could not determine home directory");
  }
  return home;
}

/**
 * Joins path segments using the correct separator for the OS
 */
export function joinPath(...segments: string[]): string {
  const os = detectOS();
  const sep = os.isWindows ? "\\" : "/";
  return segments.join(sep);
}
