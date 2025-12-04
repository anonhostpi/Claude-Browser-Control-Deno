/**
 * OS Detection Module
 * Identifies the host operating system and provides platform-specific paths
 */

export type Platform = "windows" | "darwin" | "linux";
export type DenoOS = typeof Deno.build.os;

export class OS {
  static #instance: OS | null = null;

  static get instance(): OS {
    return this.#instance ??= new OS();
  }

  readonly platform: Platform;
  readonly home: string;
  readonly localAppData?: string;

  private constructor() {
    this.platform = this.#mapPlatform(Deno.build.os);
    this.home = this.#getHome();
    this.localAppData = this.isWindows ? Deno.env.get("LOCALAPPDATA") : undefined;
  }

  #mapPlatform(os: DenoOS): Platform {
    if (os === "windows") return "windows";
    if (os === "darwin") return "darwin";
    return "linux";
  }

  #getHome(): string {
    const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
    if (!home) {
      throw new Error("Could not determine home directory");
    }
    return home;
  }

  get isWindows(): boolean {
    return this.platform === "windows";
  }

  get isMac(): boolean {
    return this.platform === "darwin";
  }

  get isLinux(): boolean {
    return this.platform === "linux";
  }

  get separator(): string {
    return this.isWindows ? "\\" : "/";
  }

  join(...segments: string[]): string {
    return segments.join(this.separator);
  }
}

export interface OSInfo {
  platform: Platform;
  homeDir: string;
  localAppData?: string;
  isWindows: boolean;
  isMac: boolean;
  isLinux: boolean;
}

/** @deprecated Use OS.instance instead */
export function detectOS(): OSInfo {
  const os = OS.instance;
  return {
    platform: os.platform,
    homeDir: os.home,
    localAppData: os.localAppData,
    isWindows: os.isWindows,
    isMac: os.isMac,
    isLinux: os.isLinux,
  };
}

/** @deprecated Use OS.instance.home instead */
export function getHomeDir(): string {
  return OS.instance.home;
}

/** @deprecated Use OS.instance.join() instead */
export function joinPath(...segments: string[]): string {
  return OS.instance.join(...segments);
}
