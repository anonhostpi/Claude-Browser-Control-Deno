export type Type =
  "chrome" | "edge" | "brave" | "chromium" | "vivaldi" | "opera";

export type Paths = {
  /** Possible executable paths for this browser */
  executables: string[];
  /** User data directory for profiles */
  user_data: string;
}

export type Config = {
  type: Type;
  name: string;
  paths: {
    windows: Paths;
    darwin: Paths;
    linux: Paths;
  }
}