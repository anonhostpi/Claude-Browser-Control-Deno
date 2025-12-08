import { IFullCLI, AllContractOptions, Helpers } from "../client/core.ts";

export type AdditionalCLI = {
  location: string;
  version: string;
  usage: string;
  flags: Partial<FlagMap>;
  help(): string;
  serve(): string; // returns url of server
}
export type AdditionalCommands = keyof AdditionalCLI;
export type AdditionalFlags = Helpers.FirstChars<AdditionalCommands>;
export type AdditionalOptions = AdditionalCommands | AdditionalFlags;
type VerifyAdditionals =
  Helpers.DisallowOverlap<AllContractOptions, AdditionalOptions>;
export type AllOptions = AllContractOptions | AdditionalOptions;

export type FlagMap = Record<AllOptions, boolean | string>;
export type CLIFunctions = {
  command: string;
  args: string[];
  parse(args?: string[]): Partial<FlagMap>;
}

export type ICLI = IFullCLI & AdditionalCLI & CLIFunctions;

export type {
  AllContractOptions,
}
