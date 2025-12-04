/**
 * CLI Command Handler
 * Class-based CLI for browser control operations
 */

import { Client } from "./client.ts";
import { ensureServer } from "./spawn.ts";
import { startServer } from "../server/mod.ts";

export interface CLIOptions {
  browser?: string;
  profile?: string;
  target?: string;
  url?: string;
  headless?: boolean;
  port?: number;
  parentPid?: number;
}

export class CLI {
  private client: Client | null = null;
  private options: CLIOptions = {};

  /** Initialize CLI with options */
  async init(options: CLIOptions): Promise<void> {
    this.options = options;
    await ensureServer({ port: options.port });
    this.client = new Client({ port: options.port });
  }

  /** Get initialized client or throw */
  private getClient(): Client {
    if (!this.client) {
      throw new Error("CLI not initialized. Call init() first.");
    }
    return this.client;
  }

  /** Start server (blocking) */
  async serve(): Promise<void> {
    await startServer({
      port: this.options.port,
      parentPid: this.options.parentPid,
    });
  }

  /** List available browsers */
  list(): Promise<unknown> {
    return this.getClient().listBrowsers();
  }

  /** Parse command line arguments */
  static parseArgs(args: string[]): { command: string; options: CLIOptions } {
    const command = args[0] ?? "";
    const options: CLIOptions = {};

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--")) {
        const eqIdx = arg.indexOf("=");
        const key = eqIdx > 0 ? arg.slice(2, eqIdx) : arg.slice(2);
        const value = eqIdx > 0 ? arg.slice(eqIdx + 1) : args[++i] ?? "";
        this.setOption(options, key, value);
      } else if (arg.startsWith("-") && arg.length === 2) {
        const key = arg.slice(1);
        const value = args[++i] ?? "";
        this.setOption(options, key, value);
      }
    }

    return { command, options };
  }

  private static setOption(options: CLIOptions, key: string, value: string): void {
    switch (key) {
      case "b":
      case "browser":
        options.browser = value;
        break;
      case "p":
      case "profile":
        options.profile = value;
        break;
      case "t":
      case "target":
        options.target = value;
        break;
      case "u":
      case "url":
        options.url = value;
        break;
      case "headless":
        options.headless = true;
        break;
      case "port":
        options.port = parseInt(value);
        break;
      case "parent-pid":
        options.parentPid = parseInt(value);
        break;
    }
  }
}
