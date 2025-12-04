import { startServer } from "../server/mod.ts";
import { ensureServer } from "./mod.ts";

type Primitive = string | number | boolean | null | undefined;

type CommandKeys<T> = {
  [K in keyof T]:
    // deno-lint-ignore no-explicit-any
    T[K] extends (...a: any[]) => any
      ? K
      : T[K] extends Primitive
        ? K
        : never;
}[keyof T];

// Internal private helper type
type InternalCommand<T> =
  | CommandKeys<T>        // = commands from fields/methods
  // deno-lint-ignore ban-types
  | (string & {})         // = ANY string; makes it future-proof
type ValidCommand<T> = Extract<InternalCommand<T>, keyof T>;

interface ICLI {
  location: string;
  version: string;
  usage: string;
  args: string[];
  command: string;
  flags: Record<string, string>;
  parse(args: string[]): Record<string, string>;
  help(): string;
}

// TODO: make all commands return a JSON-serializable object
export class CLI implements ICLI {
  static #instance: CLI | null = null;
  static create(
    location: string, version: string, usage: string
  ): CLI {
    if (CLI.#instance)
      throw new Error("CLI instance is a singleton and already exists.");

    return CLI.#instance = new CLI(location, version, usage);
  }
  static get instance(): CLI {
    if (!this.#instance)
      throw new Error("CLI instance not created yet.");
    return this.#instance;
  }
  private constructor(
    location: string, version: string, usage: string
  ) {
    this.location = location;
    this.version = version;
    this.usage = usage;

    this.flags = this.parse(this.args);
  }

  readonly location: string;
  readonly version: string;
  readonly usage: string;

  readonly args: string[] = Deno.args;
  readonly command: string = Deno.args[0];
  readonly flags: Record<string, string>;

  async #main(): Promise<unknown> {
    if (this.flags.help || this.flags.h)
      return this.help();

    const command = this.command as ValidCommand<this>;

    if (!this.command)
      return this.help();

    if (command === "parse")
      return this.parse(this.args);

    if (command && command in this) {
      if (typeof this[command] === "function")
        return await this[command]();
      else
        return this[command];
    }

    throw new Error(`Unknown command: ${this.command}. Use --help for usage.`);
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

    for(let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        const eqIdx = arg.indexOf("=");
        if (eqIdx > 0) {
          flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
        } else {
          flags[arg.slice(2)] = args[++i] ?? "";
        }
      } else if (arg.startsWith("-") && arg.length === 2) {
        flags[arg.slice(1)] = args[++i] ?? "";
      }
    }
    return flags;
  }

  async serve(): Promise<void> {
    const port = this.flags.port
      ? parseInt(this.flags.port)
      : undefined;
    const parentPid = this.flags["parent-pid"]
      ? parseInt(this.flags["parent-pid"])
      : undefined;
    await startServer({ port, parentPid });
  }

  // TODO: rename all instances of "Claude" to "Agent"
  #subject(): {
    browser: string;
    profile: string;
    target?: string;
    url?: string;
  } {
    const flags = this.flags;
    const browser = flags.browser ?? flags.b ?? "chrome";
    const profile = flags.profile ?? flags.p ?? "Claude";
    const target = flags.target ?? flags.t;
    const url = flags.url ?? flags.u;
    return { browser, profile, target, url };
  }
  async info(): Promise<void> {
    const { client } = await ensureServer();
    const data = await client.listBrowsers() as {
      browsers: Array<{ type: string; name: string }>
    };

    console.log("\n=== Available Browsers ===");
    for (const browser of data.browsers) {
      const info = await client.getBrowser(browser.type) as {
        name: string;
        path: string;
        profiles: Array<{ name: string; displayName: string; isDefault: boolean }>;
      };
      console.log(`\n${info.name}`);
      console.log(`  Path: ${info.path}`);
      console.log(`  Profiles:`);
      for (const p of info.profiles) {
        const marker = p.isDefault ? " [default]" : "";
        console.log(`    - ${p.displayName}${marker}`);
      }
    }
  }
  // TODO: update client methods to accept instance object
  async launch(): Promise<unknown> {
    const flags = this.flags;

    const { browser, profile } = this.#subject();
    const headless = "headless" in flags;

    const { client } = await ensureServer();
    const result = await client.launchInstance(
      browser, profile, { headless }
    );
    return result;
  }
  // TODO: add a target close method as well
  async close(): Promise<boolean> {
    const { browser, profile } = this.#subject();
    const { client } = await ensureServer();
    // TODO: make sure this throws if applicable
    await client.closeInstance(browser, profile);
    return true;
  }
  async targets(): Promise<void> {
    const { browser, profile } = this.#subject();
    const { client } = await ensureServer();
    const result = await client.getInstance(
      browser, profile
    ) as {
      targets: Array<{ id: string; type: string; title: string; url: string }>;
    };

    console.log("\n=== Targets ===");
    for (const t of result.targets) {
      console.log(`\n[${t.type}] ${t.id}`);
      console.log(`  Title: ${t.title}`);
      console.log(`  URL: ${t.url}`);
    }
  }
  async navigate(): Promise<void> {
    const { browser, profile, target, url } = this.#subject();
    if (!target) {
      throw new Error("--target required");
    }
    if (!url) {
      throw new Error("--url required");
    }

    const { client } = await ensureServer();
    await client.navigate(browser, profile, target, url);
    console.log(`Navigated to ${url}`);
  }
}