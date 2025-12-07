/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DEPRECATED - DO NOT USE                                               ║
 * ║                                                                            ║
 * ║  This module is LEGACY code kept for reference only.                       ║
 * ║  Use src/client/ and src/orchestrator/ instead.                            ║
 * ║                                                                            ║
 * ║  Active modules:                                                           ║
 * ║    - src/orchestrator/ (contract-driven REST framework)                    ║
 * ║    - src/client/ (contract-driven browser control client)                  ║
 * ║    - src/cli/ (CLI entry points)                                           ║
 * ║    - src/mcp/ (Model Context Protocol server)                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 * @deprecated
 * @module
 */

import CDP from "chrome-remote-interface";
import type Devtools from "devtools-protocol";

export type ErrorResponse = {
  error: string;
}

export type NavigateResponse = Devtools.Protocol.Page.NavigateResponse & {
  url: string;
};
export type ExecuteResponse = Devtools.Protocol.Runtime.EvaluateResponse;
export type ActivateResponse = {
  activated: true;
}

export type NodeBase = {
  nodeId: number;
  nodeName: string;
  nodeType: number;
}
export type NodeInfoResponse = NodeBase & {
  nodeValue: string;
  attributes?: string[];
}
export type TargetInfoResponse = CDP.Target
export type InstanceInfoResponse = {
  browser: string;
  profile: string;
  port: number;
  wsEndpoint: string;
  createdAt: string;
  targets: TargetInfoResponse[];
}

export type NodeListResponse = {
  nodes: NodeBase[];
}

export type BrowserInfo = {
  type: string;
  name: string;
  available: boolean;
}
export type BrowserListResponse = {
  browsers: BrowserInfo[];
}
export type BrowserInfoResponse = {
  type: string;
  name: string;
  path: string;
  profiles: { name: string; displayName?: string; isDefault?: boolean }[];
}