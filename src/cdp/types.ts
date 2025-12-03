/**
 * CDP Types
 * Type definitions for Chrome DevTools Protocol integration
 */

/** Target information returned by CDP */
export interface CDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
  devtoolsFrontendUrl?: string;
  description?: string;
}

/** Browser version information */
export interface CDPVersion {
  "Browser": string;
  "Protocol-Version": string;
  "User-Agent": string;
  "V8-Version"?: string;
  "WebKit-Version"?: string;
  webSocketDebuggerUrl?: string;
}

/** Options for CDP connection */
export interface CDPConnectionOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  target?: string | CDPTarget | ((targets: CDPTarget[]) => CDPTarget | number);
}
