/**
 * CLI Module Exports
 */

export { Controller } from "./spawn.ts";
export { CLI } from "./cli.ts";

// Export CLI-specific types (avoid PathParam conflict with client/core.ts)
export type {
  GlobalFlags,
  ContractFlags,
  ServeRestFlags,
  AllFlags,
  ShortFlag,
  LongFlag,
  ShortToLong,
  FlagMap,
  ParsedArgs,
  ContractCommand,
  IContractCLI,
  IAdditionalCLI,
  ContractInfo,
  ICLI,
  ClientLevel,
  ContractCommandName,
  AdditionalCommandName,
  CommandName,
} from "./types.ts";

export { SHORT_FLAGS } from "./types.ts";
