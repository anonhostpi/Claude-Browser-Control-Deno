/**
 * Contract-driven CLI
 *
 * Commands are derived from contract names (e.g., "endpoint:info", "context:create").
 * The colon separator prevents conflicts with built-in commands like help, serve, mcp.
 *
 * Uses the hierarchical client architecture:
 * - Endpoint: /:endpoint (browser type OR host)
 * - Context: /:endpoint/:context (profile OR port)
 * - Target: /:endpoint/:context/:target (tab/page)
 * - Node: /:endpoint/:context/:target/:node (DOM node)
 */

import { Server } from "../orchestrator/server/mod.ts";
import { Controller } from "./spawn.ts";
import { Endpoint, Context, Target, Node, Client } from "../client/mod.ts";
import { MCPServer } from "../mcp/mod.ts";
import { contracts, Root } from "../orchestrator/contracts/api.ts";
import type * as API from "../orchestrator/contracts/api.ts";

type CommandDescriptor = {
  requires: string[];
  depends: string[];
}

type RootCommands = {
  "root":         CommandDescriptor;
  "root:health":  CommandDescriptor;
  "root:list":    CommandDescriptor;
  "root:killAll": CommandDescriptor;
}
type TestRootCommands = API.Root.AssertBinding<RootCommands>;
type EndpointCommands = {
  "endpoint":         CommandDescriptor;
  "endpoint:exists":  CommandDescriptor;
  "endpoint:info":    CommandDescriptor;
  "endpoint:launch":  CommandDescriptor;
  "endpoint:killAll": CommandDescriptor;
}
type TestEndpointCommands = API.Endpoint.AssertBinding<EndpointCommands>;
type ContextCommands = {
  "context":        CommandDescriptor;
  "context:exists": CommandDescriptor;
  "context:info":   CommandDescriptor;
  "context:create": CommandDescriptor;
  "context:close":  CommandDescriptor;
}
type TestContextCommands = API.Context.AssertBinding<ContextCommands>;
type TargetCommands = {
  "target":           CommandDescriptor;
  "target:exists":    CommandDescriptor;
  "target:info":      CommandDescriptor;
  "target:cdp":       CommandDescriptor;
  "target:control":   CommandDescriptor;
  "target:content":   CommandDescriptor;
  "target:emulate":   CommandDescriptor;
  "target:throttle":  CommandDescriptor;
  "target:intercept": CommandDescriptor;
  "target:label":     CommandDescriptor;
  "target:create":    CommandDescriptor;
  "target:close":     CommandDescriptor;
}
type TestTargetCommands = API.Target.AssertBinding<TargetCommands>;
type NodeCommands = {
  "node":          CommandDescriptor;
  "node:exists":   CommandDescriptor;
  "node:info":     CommandDescriptor;
  "node:create":   CommandDescriptor;
  "node:replace":  CommandDescriptor;
  "node:interact": CommandDescriptor;
  "node:remove":   CommandDescriptor;
}
type TestNodeCommands = API.Node.AssertBinding<NodeCommands>;
type AllCommands =
  & RootCommands
  & EndpointCommands
  & ContextCommands
  & TargetCommands
  & NodeCommands;

// Path parameter names extracted from contract paths
const PATH_PARAMS = ["endpoint", "context", "target", "node"] as const;
type PathParam = (typeof PATH_PARAMS)[number];

interface ICLI {
  location: string;
  version: string;
  usage: string;
  flags: Record<string, string>;
  help(): string;
  command: string;
  args: string[];
  parse(args: string[]): Record<string, string>;
}

export class CLI implements ICLI {
  static #instance: CLI | null = null;
  static create(location: string, version: string, usage: string): CLI {
    if (CLI.#instance)
      throw new Error("CLI instance is a singleton and already exists.");

    return (CLI.#instance = new CLI(location, version, usage));
  }
  static get instance(): CLI {
    if (!this.#instance) throw new Error("CLI instance not created yet.");
    return this.#instance;
  }
  private constructor(location: string, version: string, usage: string) {
    this.location = location;
    this.version = version;
    this.usage = usage;

    this.flags = this.parse(this.args);

    this.#controller = Controller.create(location);
  }

  static #expand(
    input: string,
    lookup: (name: string) => string | undefined,
    { required = true } = {}
  ): string {
    return input.replace(/\$([A-Za-z0-9_]+)|\$\{([^}]+)\}/g, (_, a, b) => {
      const name = a ?? b;
      const val = lookup(name);

      if (val === undefined) {
        if (required) throw new Error(`Missing required variable ${name}`);
        return "";
      }

      return val;
    });
  }
  static expand(input: string, vars?: Record<string, string>): string {
    return this.#expand(input, (name) => {
      if (vars && name in vars) return vars[name];
      return Deno.env.get(name);
    });
  }
  static exists(
    type: "file" | "directory",
    path: string,
    evaluate = false,
    vars?: Record<string, string>
  ): boolean {
    const expanded = evaluate ? this.expand(path, vars) : path;
    try {
      const stat = Deno.statSync(expanded);
      if (!stat) return false;

      return type === "file" ? stat.isFile : stat.isDirectory;
    } catch {
      return false;
    }
  }

  readonly location: string;
  readonly version: string;
  readonly usage: string;

  readonly args: string[] = Deno.args;
  readonly command: string = Deno.args[0];
  readonly flags: Record<string, string>;

  #controller: Controller;

  /** Get required flag or throw */
  #require(name: PathParam): string {
    const value = this.flags[name];
    if (!value) {
      throw new Error(`Missing required flag --${name}`);
    }
    return value;
  }

  /** Build request body from flags (excluding path params and built-in flags) */
  #buildRequest(
    excludeParams: PathParam[] = []
  ): Record<string, unknown> | undefined {
    const request: Record<string, unknown> = {};
    const excluded = new Set<string>([
      ...excludeParams,
      "help",
      "h",
      "server",
      "port",
      "parent-pid",
      "api-url",
    ]);

    for (const [key, value] of Object.entries(this.flags)) {
      if (excluded.has(key)) continue;

      // Parse value types
      if (value === "" || value === "true") {
        request[key] = true;
      } else if (value === "false") {
        request[key] = false;
      } else if (!isNaN(Number(value)) && value !== "") {
        request[key] = Number(value);
      } else {
        request[key] = value;
      }
    }

    return Object.keys(request).length > 0 ? request : undefined;
  }

  /** Get the endpoint client */
  #getEndpoint(): Endpoint {
    const endpointName = this.#require("endpoint");
    return new Endpoint(endpointName);
  }

  /** Get the context client */
  async #getContext(): Promise<Context> {
    const endpoint = this.#getEndpoint();
    const contextName = this.#require("context");
    return await endpoint.context(contextName);
  }

  /** Get or create target client */
  #getTarget(): Target {
    const endpoint = this.#getEndpoint();
    const contextName = this.#require("context");
    const targetId = this.#require("target");
    // Build target directly without creating context
    const context = new Client(endpoint, contextName);
    return new Target(context, targetId);
  }

  /** Get node client */
  #getNode(): Node {
    const target = this.#getTarget();
    const nodeId = parseInt(this.#require("node"));
    return new Node(target, nodeId);
  }

  /** Execute root-level commands */
  async #executeRoot(action: string): Promise<unknown> {
    const { health, list, killAll } = Root.miniclient();

    switch (action) {
      case "health":
        return await health(Endpoint.server);
      case "list":
        return await list(Endpoint.server);
      case "killAll":
        return await killAll(Endpoint.server);
      default:
        throw new Error(`Unknown root action: ${action}`);
    }
  }

  /** Execute endpoint-level commands */
  async #executeEndpoint(action: string): Promise<unknown> {
    const endpoint = this.#getEndpoint();

    switch (action) {
      case "exists":
        return { exists: await endpoint.exists() };
      case "info":
        return await endpoint.info();
      case "launch": {
        const headless = "headless" in this.flags;
        const port = this.flags.port ? parseInt(this.flags.port) : undefined;
        return await endpoint.launch({ headless, port });
      }
      case "killAll":
        return await endpoint.killAll();
      default:
        throw new Error(`Unknown endpoint action: ${action}`);
    }
  }

  /** Execute context-level commands */
  async #executeContext(action: string): Promise<unknown> {
    switch (action) {
      case "exists": {
        const endpoint = this.#getEndpoint();
        const contextName = this.#require("context");
        const context = new Client(endpoint, contextName);
        return { exists: await context.alive() };
      }
      case "info": {
        const context = await this.#getContext();
        return await context.info();
      }
      case "create": {
        const headless = "headless" in this.flags;
        const port = this.flags.port ? parseInt(this.flags.port) : undefined;
        const context = await this.#getContext();
        // Context.create already launches if not exists
        return { created: true, context: context.context, headless, port };
      }
      case "close": {
        const context = await this.#getContext();
        await context.close();
        return { closed: true };
      }
      default:
        throw new Error(`Unknown context action: ${action}`);
    }
  }

  /** Execute target-level commands */
  async #executeTarget(action: string): Promise<unknown> {
    const target = this.#getTarget();

    switch (action) {
      case "exists":
        return { exists: await target.exists() };
      case "info": {
        const xpath = this.flags.xpath;
        const css = this.flags.css;
        return await target.info(xpath || css ? { xpath, css } : undefined);
      }
      case "cdp":
        return { webSocketDebuggerUrl: await target.cdp() };
      case "control": {
        const request = this.#buildRequest(["endpoint", "context", "target"]);
        if (!request) throw new Error("No control action specified");
        return await target.control(request);
      }
      case "content": {
        const request = this.#buildRequest(["endpoint", "context", "target"]);
        if (!request) throw new Error("No content action specified");
        return await target.content(request);
      }
      case "emulate": {
        const request = this.#buildRequest(["endpoint", "context", "target"]);
        if (!request) throw new Error("No emulation settings specified");
        return await target.emulate(request);
      }
      case "throttle": {
        const request = this.#buildRequest(["endpoint", "context", "target"]);
        if (!request) throw new Error("No throttle settings specified");
        return await target.throttle(request);
      }
      case "intercept": {
        const request = this.#buildRequest(["endpoint", "context", "target"]);
        if (!request) throw new Error("No intercept rules specified");
        return await target.intercept(request);
      }
      case "label": {
        const request = this.#buildRequest(["endpoint", "context", "target"]);
        if (!request) throw new Error("No label data specified");
        return await target.label(request);
      }
      case "create": {
        const url = this.flags.url;
        if (!url) throw new Error("Missing required flag --url");
        const endpoint = this.#getEndpoint();
        const contextName = this.#require("context");
        const context = await endpoint.context(contextName);
        const newTarget = await context.target(url);
        if (!newTarget) throw new Error("Failed to create target");
        return { id: newTarget.id, url };
      }
      case "close":
        await target.close();
        return { closed: true };
      default:
        throw new Error(`Unknown target action: ${action}`);
    }
  }

  /** Execute node-level commands */
  async #executeNode(action: string): Promise<unknown> {
    const node = this.#getNode();

    switch (action) {
      case "exists":
        return { exists: await node.exists() };
      case "info": {
        const children = "children" in this.flags;
        const depth = this.flags.depth
          ? parseInt(this.flags.depth)
          : undefined;
        return await node.info(
          children || depth ? { children, depth } : undefined
        );
      }
      case "create": {
        const request = this.#buildRequest([
          "endpoint",
          "context",
          "target",
          "node",
        ]);
        if (!request) throw new Error("No create data specified");
        return await node.create(request);
      }
      case "replace": {
        const request = this.#buildRequest([
          "endpoint",
          "context",
          "target",
          "node",
        ]);
        if (!request) throw new Error("No replace data specified");
        return await node.replace(request);
      }
      case "interact": {
        const request = this.#buildRequest([
          "endpoint",
          "context",
          "target",
          "node",
        ]);
        if (!request) throw new Error("No interact action specified");
        return await node.interact(request);
      }
      case "remove":
        await node.remove();
        return { removed: true };
      default:
        throw new Error(`Unknown node action: ${action}`);
    }
  }

  /** Execute a contract command using hierarchical clients */
  async #executeContract(command: string): Promise<unknown> {
    // Ensure server is running
    await this.#controller.ensure();

    // Configure server URL
    const serverUrl = this.flags.server ?? "http://localhost:9333";
    Endpoint.configure(serverUrl);

    // Parse command: namespace:action
    const [namespace, action] = command.split(":");
    if (!action) {
      throw new Error(`Invalid command format: ${command}`);
    }

    switch (namespace) {
      case "root":
        return await this.#executeRoot(action);
      case "endpoint":
        return await this.#executeEndpoint(action);
      case "context":
        return await this.#executeContext(action);
      case "target":
        return await this.#executeTarget(action);
      case "node":
        return await this.#executeNode(action);
      default:
        throw new Error(`Unknown namespace: ${namespace}`);
    }
  }

  async #main(): Promise<unknown> {
    if ("help" in this.flags || "h" in this.flags) return this.help();

    if (!this.command || this.command.startsWith("-")) return this.help();

    // Check if it's a contract command (contains colon)
    if (this.command.includes(":")) {
      return await this.#executeContract(this.command);
    }

    // Built-in commands
    switch (this.command) {
      case "help":
        return this.help();
      case "version":
        return this.version;
      case "serve":
        return await this.serve();
      case "mcp":
        return await this.mcp();
      case "contracts":
        return this.contracts();
      default:
        throw new Error(
          `Unknown command: ${this.command}. Use --help for usage.`
        );
    }
  }

  async main(): Promise<void> {
    try {
      const result = await this.#main();
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

  help(): string {
    return this.usage;
  }

  parse(args: string[]): Record<string, string> {
    const flags: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        const eqIdx = arg.indexOf("=");
        if (eqIdx > 0) {
          flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
        } else {
          const next = args[i + 1];
          // If no next arg or next arg is a flag, treat as boolean
          if (!next || next.startsWith("-")) {
            flags[arg.slice(2)] = "";
          } else {
            flags[arg.slice(2)] = next;
            i++;
          }
        }
      } else if (arg.startsWith("-") && arg.length === 2) {
        const next = args[i + 1];
        if (!next || next.startsWith("-")) {
          flags[arg.slice(1)] = "";
        } else {
          flags[arg.slice(1)] = next;
          i++;
        }
      }
    }
    return flags;
  }

  /** List all available contract commands */
  contracts(): {
    contracts: {
      name: string;
      method: string;
      path: string;
      description: string;
    }[];
  } {
    return {
      contracts: contracts.map((c) => ({
        name: c.name,
        method: c.method,
        path: c.path,
        description: c.description,
      })),
    };
  }

  async serve(): Promise<void> {
    const port = this.flags.port ? parseInt(this.flags.port) : undefined;
    const pid = this.flags["parent-pid"]
      ? parseInt(this.flags["parent-pid"])
      : undefined;
    await Server.create({ port, pid }).start();
  }

  async mcp(): Promise<void> {
    const apiUrl = this.flags["api-url"];
    const server = new MCPServer({ apiUrl });
    await server.run();
  }
}
