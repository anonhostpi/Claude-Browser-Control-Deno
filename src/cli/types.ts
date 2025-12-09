/**
 * CLI Type Definitions
 *
 * Type-safe CLI types derived from contract definitions.
 * All types are auto-derived from API bindings where possible.
 *
 * Note: MCP commands are registered dynamically via CLI.register()
 * and are not part of these static type definitions.
 */

import * as API from "../orchestrator/contracts/api.ts";
import { Helpers, PathParam, PathParams, ClientLevel } from "../client/core.ts";

// =============================================================================
// JSON Serializable Types
// =============================================================================

import type {
  JSONPrimitive,
  JSONSerializable
} from "../orchestrator/schema.ts";

// =============================================================================
// Flag Types (Segmented by Command)
// =============================================================================

/**
 * Global flags available for all commands
 */
export type GlobalFlags = {
  help?: boolean;
};

/**
 * Contract command flags (path params + server URL)
 */
export type ContractFlags = {
  server?: string;
} & PathParams;

/**
 * serve:rest command flags
 */
export type ServeRestFlags = {
  host?: string;
  port?: string;
};

/**
 * All possible flags combined
 * Note: serve:mcp uses --server (same as contract commands)
 */
export type AllFlags = GlobalFlags & ContractFlags & ServeRestFlags;

// =============================================================================
// Short Flag Mapping
// =============================================================================

/**
 * Long flag to short flag mapping
 * Uses -i for host (as in IP) to avoid collision
 */
export const SHORT_FLAGS = {
  // Global
  help: "h",
  // Contract flags (also used by serve:mcp)
  server: "s",
  endpoint: "e",
  context: "c",
  target: "t",
  node: "n",
  // serve:rest flags
  host: "i", // as in IP
  port: "p",
} as const;

/**
 * Short flag keys
 */
export type ShortFlag = (typeof SHORT_FLAGS)[keyof typeof SHORT_FLAGS];

/**
 * Long flag keys
 */
export type LongFlag = keyof typeof SHORT_FLAGS;

/**
 * Reverse mapping: short flag to long flag
 */
export type ShortToLong = {
  [K in keyof typeof SHORT_FLAGS as (typeof SHORT_FLAGS)[K]]: K;
};

// Compile-time overlap verification using Helpers
type _VerifyNoShortFlagCollisions = Helpers.DisallowOverlap<
  Helpers.FirstChars<Exclude<PathParam, "root">>,
  Helpers.FirstChars<"server" | "host" | "port" | "help">
>;

// =============================================================================
// Flag Map (Parsed Flags)
// =============================================================================

/**
 * Parsed flag values - tracks both presence (boolean) and values (string)
 */
export type FlagMap = {
  [K in LongFlag]?: string | boolean;
};

/**
 * Parsed CLI arguments result
 */
export type ParsedArgs = {
  command?: string;
  flags: FlagMap;
  remaining: JSONPrimitive[];
  json?: JSONSerializable;
};

// =============================================================================
// Contract Command Types
// =============================================================================

/**
 * Contract command type - async function returning JSON-serializable result
 * Used sparingly in interfaces only
 */
export type CommandFunction = () => Promise<JSONSerializable>;

/**
 * Contract CLI interface - maps full contract names to commands.
 * Auto-generated in api.ts from all contract namespaces.
 */
export type IContractCLI = API.IContractCLI<CommandFunction>;

// =============================================================================
// Additional CLI Commands
// =============================================================================

/**
 * Additional (non-contract) CLI commands interface.
 * Note: MCP commands are registered dynamically and not listed here.
 */
export interface IAdditionalCLI {
  // Getters (synchronous, JSON-serializable)
  readonly version: string;
  readonly location: string;

  // Async commands
  help(command?: string): Promise<string>;
  usage(command?: string): Promise<string>;
  contracts(): Promise<ContractInfo[]>;
  "serve:rest"(): Promise<void>;
}

/**
 * Contract info for listing
 */
export interface ContractInfo {
  name: string;
  description: string;
  method: string;
  path: string;
  hasRequest: boolean;
  hasResponse: boolean;
}

// =============================================================================
// Full CLI Interface
// =============================================================================

/**
 * Complete CLI interface combining contracts and additional commands
 */
export type ICLI = IContractCLI & IAdditionalCLI;

// =============================================================================
// Client Level Type (re-exported from client/core.ts)
// =============================================================================

export type { ClientLevel };

// =============================================================================
// Command Names
// =============================================================================

/**
 * All contract command names
 */
export type ContractCommandName = keyof IContractCLI;

/**
 * Additional command names (built-in only).
 * Note: MCP commands are registered dynamically and resolved at runtime.
 */
export type AdditionalCommandName =
  | "help"
  | "usage"
  | "version"
  | "location"
  | "contracts"
  | "serve:rest";

/**
 * All command names
 */
export type CommandName = ContractCommandName | AdditionalCommandName;
