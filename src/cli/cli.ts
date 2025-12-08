/**
 * Contract-driven CLI (v2)
 *
 * All commands are class members with type-tight return types.
 * Uses src/client library classes directly (not miniclient).
 *
 * Commands are derived from contract names (e.g., "endpoint:info", "context:create").
 * The colon separator prevents conflicts with built-in commands like help, serve.
 */

import { Server } from "../orchestrator/server/mod.ts";
import { Controller } from "./spawn.ts";
import { Root, Endpoint, Context, Target, Node } from "../client/mod.ts";
import { MCPServer } from "../mcp/mod.ts";
import { contracts } from "../orchestrator/contracts/api.ts";
import * as API from "../orchestrator/contracts/api.ts";
import {
  type ICLI,
  type FlagMap,
  type ParsedArgs,
  type ContractInfo,
  type LongFlag,
  SHORT_FLAGS,
} from "./types.ts";

import type {
  JSONPrimitive,
  JSONSerializable,
} from "../orchestrator/schema.ts";

// Reverse mapping: short flag -> long flag
const LONG_FLAGS: Record<string, LongFlag> = Object.fromEntries(
  Object.entries(SHORT_FLAGS).map(([long, short]) => [short, long as LongFlag])
);

export class CLI implements ICLI {
  // ==========================================================================
  // Static Parse Method (settable)
  // ==========================================================================

  static parse: (args: string[]) => ParsedArgs = function (args: string[]): ParsedArgs {
    const flags: FlagMap = {};
    const remaining: JSONPrimitive[] = [];
    let command: string | undefined;

    for(let i = 0; i < args.length; i++) {
      const arg = args[i];

      // First non-flag argument is the command
      if (!command && !arg.startsWith("-")) {
        command = arg;
        continue;
      }

      // Long flag: --name, --name value, or --name=value
      if (arg.startsWith("--")) {
        const eqIdx = arg.indexOf("=");
        if (eqIdx > 0) {
          const name = arg.slice(2, eqIdx) as LongFlag;
          flags[name] = arg.slice(eqIdx + 1);
        } else {
          const name = arg.slice(2) as LongFlag;
          const next = args[i + 1];
          if (!next || next.startsWith("-")) {
            flags[name] = true;
          } else {
            flags[name] = next;
            i++;
          }
        }
        continue;
      }

      // Short flag: -x, -x value, or combined -xyz
      if (arg.startsWith("-")) {
        if (arg.length === 2) {
          const shortFlag = arg.slice(1);
          const longFlag = LONG_FLAGS[shortFlag];
          const name = longFlag ?? (shortFlag as LongFlag);
          const next = args[i + 1];
          if (!next || next.startsWith("-")) {
            flags[name] = true;
          } else {
            flags[name] = next;
            i++;
          }
        } else {
          for (const char of arg.slice(1)) {
            const longFlag = LONG_FLAGS[char];
            const name = longFlag ?? (char as LongFlag);
            flags[name] = true;
          }
        }
        continue;
      }

      remaining.push(arg);
    }

    let json: JSONSerializable | undefined;
    for (let i = 0; i < remaining.length; i++) {
      const arg = remaining[i];
      try {
        const parsed = JSON.parse(arg as string);
        switch (typeof parsed) {
          case "number":
          case "boolean":
          case "string":
            remaining[i] = parsed;
            continue;
          case "undefined":
            // remove undefined
            remaining.splice(i, 1);
            i--;
            continue;
          default:
            if (!json) {
              remaining.splice(i, 1);
              i--;
              json = parsed;
            }
        }
      } catch {
        // not JSON, continue
      }
    }
    return {
      command, flags, remaining, json
    }
  }

  // ==========================================================================
  // Singleton Pattern
  // ==========================================================================

  static #instance: CLI | null = null;

  static create(location: string, version: string, usage: string): CLI {
    if (CLI.#instance) {
      throw new Error("CLI instance is a singleton and already exists.");
    }
    return (CLI.#instance = new CLI(location, version, usage));
  }

  static get instance(): CLI {
    if (!this.#instance) {
      throw new Error("CLI instance not created yet.");
    }
    return this.#instance;
  }

  // ==========================================================================
  // Instance Properties
  // ==========================================================================

  readonly #location: string;
  readonly #version: string;
  readonly #usage: string;
  readonly #controller: Controller;

  #cached: ParsedArgs | null = null;

  private constructor(location: string, version: string, usage: string) {
    this.#location = location;
    this.#version = version;
    this.#usage = usage;
    this.#controller = Controller.create(location);
  }

  // ==========================================================================
  // Lazy Getters
  // ==========================================================================

  get #parsed(): ParsedArgs {
    return (this.#cached ??= CLI.parse(Deno.args));
  }

  get flags(): FlagMap {
    return this.#parsed.flags;
  }

  get #command(): string | undefined {
    return this.#parsed.command;
  }

  get #json(): JSONSerializable | undefined {
    return this.#parsed.json;
  }

  // ==========================================================================
  // Public Getters (Commands)
  // ==========================================================================

  get version(): string {
    return this.#version;
  }

  get location(): string {
    return this.#location;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /** Get required flag value or throw */
  #require(name: LongFlag): string {
    const value = this.flags[name];
    if (value === undefined || value === true || value === false) {
      throw new Error(`Missing required flag --${name}`);
    }
    return value;
  }

  /** Get optional flag value as string */
  #optional(name: LongFlag): string | undefined {
    const value = this.flags[name];
    if (value === undefined || typeof value === "boolean") return undefined;
    return value;
  }

  /** Check if flag is present (boolean) */
  #has(name: LongFlag): boolean {
    return this.flags[name] !== undefined;
  }

  // ==========================================================================
  // Client Getters
  // ==========================================================================

  #server?: Awaited<ReturnType<Controller["ensure"]>>;
  async #ensure(): Promise<void> {
    if (!this.#server)
      this.#server = await this.#controller.ensure();
  }

  async #getRoot(): Promise<Root> {
    await this.#ensure();
    const serverUrl = this.#optional("server") ?? "http://localhost:9333";
    return new Root(serverUrl);
  }

  async #getEndpoint(): Promise<Endpoint> {
    const root = await this.#getRoot();
    const name = this.#require("endpoint");
    return new Endpoint(root, name);
  }

  async #getContext(): Promise<Context> {
    const endpoint = await this.#getEndpoint();
    const name = this.#require("context");
    return new Context(endpoint, name);
  }

  async #getTarget(): Promise<Target> {
    const context = await this.#getContext();
    const targetId = this.#require("target");
    return new Target(context, targetId);
  }

  async #getNode(): Promise<Node> {
    const target = await this.#getTarget();
    const nodeId = parseInt(this.#require("node"));
    return new Node(target, nodeId);
  }

  // ==========================================================================
  // Root Contract Commands
  // ==========================================================================

  async "root:health"(): Promise<void> {
    const root = await this.#getRoot();
    const healthy = await root.health();
    if (!healthy) {
      throw new Error("Server health check failed");
    }
  }

  async "root:list"(): Promise<API.Root.ListResponse> {
    const root = await this.#getRoot();
    return await root.list();
  }

  async "root:killAll"(): Promise<API.Root.KillAllResponse> {
    const root = await this.#getRoot();
    return await root.killAll();
  }

  // ==========================================================================
  // Endpoint Contract Commands
  // ==========================================================================

  async "endpoint:exists"(): Promise<boolean> {
    const endpoint = await this.#getEndpoint();
    return await endpoint.exists();
  }

  async "endpoint:info"(): Promise<API.Endpoint.InfoResponse> {
    const endpoint = await this.#getEndpoint();
    const body = this.#json as API.Endpoint.InfoRequest | undefined;
    return await endpoint.info(body ?? {});
  }

  async "endpoint:launch"(): Promise<API.Endpoint.LaunchResponse> {
    const endpoint = await this.#getEndpoint();
    const body = this.#json as API.Endpoint.LaunchRequest | undefined;
    return await endpoint.launch(body ?? { headless: false });
  }

  async "endpoint:killAll"(): Promise<API.Endpoint.KillAllResponse> {
    const endpoint = await this.#getEndpoint();
    return await endpoint.killAll();
  }

  // ==========================================================================
  // Context Contract Commands
  // ==========================================================================

  async "context:exists"(): Promise<boolean> {
    const context = await this.#getContext();
    return await context.exists();
  }

  async "context:info"(): Promise<API.Context.InfoResponse> {
    const context = await this.#getContext();
    return await context.info();
  }

  async "context:create"(): Promise<API.Context.CreateResponse> {
    const context = await this.#getContext();
    const body = this.#json as API.Context.CreateRequest | undefined;

    // Create context using the context client directly
    const created = await context.create(body ?? { headless: false });

    // Get info to return proper response
    if (created) {
      const info = await context.info();
      return { ...info, created: true } as API.Context.CreateResponse;
    }

    // Context already existed, return info
    const info = await context.info();
    return { ...info, created: false } as API.Context.CreateResponse;
  }

  async "context:close"(): Promise<void> {
    const context = await this.#getContext();
    await context.close();
  }

  // ==========================================================================
  // Target Contract Commands
  // ==========================================================================

  async "target:exists"(): Promise<boolean> {
    const target = await this.#getTarget();
    return await target.exists();
  }

  async "target:info"(): Promise<API.Target.InfoResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.InfoRequest | undefined;
    return await target.info(body ?? {});
  }

  async "target:cdp"(): Promise<API.Target.CdpResponse> {
    const target = await this.#getTarget();
    return await target.cdp();
  }

  async "target:control"(): Promise<API.Target.ControlResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.ControlRequest | undefined;
    if (!body) throw new Error("No control action specified (provide JSON body)");
    return await target.control(body);
  }

  async "target:create"(): Promise<API.Target.CreateResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.CreateRequest | undefined;
    if (!body?.url) throw new Error("Missing required 'url' in JSON body");
    return await target.create(body);
  }

  async "target:content"(): Promise<API.Target.ContentResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.ContentRequest | undefined;
    if (!body) throw new Error("No content action specified (provide JSON body)");
    return await target.content(body);
  }

  async "target:emulate"(): Promise<API.Target.EmulateResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.EmulateRequest | undefined;
    if (!body) throw new Error("No emulation settings specified (provide JSON body)");
    return await target.emulate(body);
  }

  async "target:throttle"(): Promise<API.Target.ThrottleResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.ThrottleRequest | undefined;
    if (!body) throw new Error("No throttle settings specified (provide JSON body)");
    return await target.throttle(body);
  }

  async "target:intercept"(): Promise<API.Target.InterceptResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.InterceptRequest | undefined;
    if (!body) throw new Error("No intercept rules specified (provide JSON body)");
    return await target.intercept(body);
  }

  async "target:label"(): Promise<API.Target.LabelResponse> {
    const target = await this.#getTarget();
    const body = this.#json as API.Target.LabelRequest | undefined;
    if (!body) throw new Error("No label data specified (provide JSON body)");
    return await target.label(body);
  }

  async "target:close"(): Promise<void> {
    const target = await this.#getTarget();
    await target.close();
  }

  // ==========================================================================
  // Node Contract Commands
  // ==========================================================================

  async "node:exists"(): Promise<boolean> {
    const node = await this.#getNode();
    return await node.exists();
  }

  async "node:info"(): Promise<API.Node.InfoResponse> {
    const node = await this.#getNode();
    const body = this.#json as API.Node.InfoRequest | undefined;
    return await node.info(body ?? {});
  }

  async "node:create"(): Promise<API.Node.CreateResponse> {
    const node = await this.#getNode();
    const body = this.#json as API.Node.CreateRequest | undefined;
    if (!body) throw new Error("No create data specified (provide JSON body)");
    const created = await node.create(body);
    // The created node returns info via the Node class
    return await created.info() as unknown as API.Node.CreateResponse;
  }

  async "node:replace"(): Promise<API.Node.ReplaceResponse> {
    const node = await this.#getNode();
    const body = this.#json as API.Node.ReplaceRequest | undefined;
    if (!body) throw new Error("No replace data specified (provide JSON body)");
    return await node.replace(body);
  }

  async "node:interact"(): Promise<API.Node.InteractResponse> {
    const node = await this.#getNode();
    const body = this.#json as API.Node.InteractRequest | undefined;
    if (!body) throw new Error("No interact action specified (provide JSON body)");
    return await node.interact(body);
  }

  async "node:remove"(): Promise<void> {
    const node = await this.#getNode();
    await node.remove();
  }

  // ==========================================================================
  // Additional Commands
  // ==========================================================================

  help(): Promise<string> {
    const command = this.#parsed.remaining[0];
    if (!command) {
      return Promise.resolve(this.#usage);
    }

    // Find contract by name
    const contract = contracts.find((c) => c.name === command);
    if (!contract) {
      return Promise.resolve(`Unknown command: ${command}\n\nUse 'help' to see all available commands.`);
    }

    let helpText = `${contract.name} - ${contract.description}\n\n`;
    helpText += `Method: ${contract.method}\n`;
    helpText += `Path: ${contract.path}\n`;

    // Extract path params from path
    const pathParams = contract.path.match(/:(\w+)/g);
    if (pathParams && pathParams.length > 0) {
      helpText += `\nPath parameters (required):\n`;
      for (const param of pathParams) {
        const name = param.slice(1);
        const shortFlag = SHORT_FLAGS[name as keyof typeof SHORT_FLAGS];
        helpText += `  -${shortFlag}, --${name}\n`;
      }
    }

    if ("request" in contract && contract.request) {
      helpText += `\nRequest body (JSON):\n`;
      const props = (contract.request as { properties?: Record<string, unknown> }).properties;
      if (props) {
        helpText += `  { ${Object.keys(props).join(", ")} }\n`;
      }
    }

    return Promise.resolve(helpText);
  }

  usage(): Promise<string> {
    return this.help();
  }

  contracts(): Promise<ContractInfo[]> {
    return Promise.resolve(contracts.map((c) => ({
      name: c.name,
      description: c.description,
      method: c.method,
      path: c.path,
      hasRequest: "request" in c,
      hasResponse: "response" in c,
    })));
  }

  async "serve:rest"(): Promise<void> {
    const _port = this.#optional("port");
    const _pid = this.#optional("parent-pid" as LongFlag);
    
    const host = this.#optional("host") ?? "localhost";
    const port = _port ? parseInt(_port) : 9333;
    const pid = _pid ? parseInt(_pid) : undefined;

    await Server.create({ port, pid, hostname: host }).start();
  }

  async "serve:mcp"(): Promise<void> {
    const apiUrl = this.#optional("server");
    const server = new MCPServer({ apiUrl });
    await server.run();
  }

  // ==========================================================================
  // Main Entry Point
  // ==========================================================================

  async main(): Promise<void> {
    try {
      const result = await this.#dispatch();
      if (result !== undefined) {
        if (typeof result === "string") {
          console.log(result);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      }
    } catch (error) {
      console.error(error);
      Deno.exit(1);
    }
  }

  async #dispatch(): Promise<unknown> {
    // Help flag takes precedence
    if (this.#has("help")) {
      return console.error(await this.help());
    }

    // No command or command starts with dash -> show help
    if (!this.#command || this.#command.startsWith("-")) {
      return console.error(await this.help());
    }

    const cmd = this.#command;

    if (cmd === "help" || cmd === "usage") {
      return console.error(await this.help());
    }

    // Blacklist private members and internal methods
    if (cmd.startsWith("#") || cmd.startsWith("_")) {
      throw new Error(`Unknown command: ${cmd}. Use --help for usage.`);
    }

    // Look up the member on the CLI instance
    const member = this[cmd as keyof this];
    if (member === undefined) {
      throw new Error(`Unknown command: ${cmd}. Use --help for usage.`);
    }

    // If it's a function, call it
    if (typeof member === "function") {
      return await (member as () => Promise<unknown>).call(this);
    }

    // Otherwise return the value directly (e.g., version, location)
    return member as JSONSerializable;
  }
}
