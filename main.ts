/**
 * Claude Browser Control - CLI Entry Point
 */

import { startServer } from "./src/server/mod.ts";
import { ensureServer } from "./src/cli/mod.ts";
import { parse } from "@std/jsonc";

if (!import.meta.main)
  throw new Error("main.ts should be run as a command.");

// get version from ./deno.json:
const LOCATION = import.meta.dirname;
const VERSION = await (async () => {
  const metadata = await Deno.readTextFile(
    `${LOCATION}/deno.json`);
  const json = parse(metadata) as { version: string };
  return json.version;
})();
const USAGE = `
Claude Browser Control - Control Chrome-based browsers with Deno

USAGE:
  deno task start [command] [options]

COMMANDS:
  serve             Start the API server
  info              List browsers and profiles
  launch            Launch a browser instance
  close             Close a browser instance
  targets           List targets in an instance
  navigate          Navigate a target to URL

SERVER OPTIONS:
  --port            Server port (default: 9333)
  --parent-pid      Exit when parent PID dies

BROWSER OPTIONS:
  --browser, -b     Browser type: chrome, edge, brave, chromium, vivaldi
  --profile, -p     Profile name (default: "Claude")
  --url, -u         URL to open or navigate to
  --target, -t      Target ID for target operations
  --headless        Run browser in headless mode

EXAMPLES:
  deno task start serve
  deno task start info
  deno task start launch -b chrome -p Claude
  deno task start targets -b chrome -p Claude
  deno task start navigate -b chrome -p Claude -t <id> -u https://example.com
  deno task start close -b chrome -p Claude
`;

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
class CLI implements ICLI {
  static Application: CLI = new CLI();
  private constructor() {
    this.flags = this.parse(this.args);
  }

  readonly location: string = LOCATION as string;
  readonly args: string[] = Deno.args;
  readonly command: string = Deno.args[0];
  readonly flags: Record<string, string>;
  readonly version: string = VERSION;
  readonly usage: string = USAGE;

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
  #instance(): {
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

    const { browser, profile } = this.#instance();
    const headless = "headless" in flags;

    const { client } = await ensureServer();
    const result = await client.launchInstance(
      browser, profile, { headless }
    );
    return result;
  }
  // TODO: add a target close method as well
  async close(): Promise<boolean> {
    const { browser, profile } = this.#instance();
    const { client } = await ensureServer();
    // TODO: make sure this throws if applicable
    await client.closeInstance(browser, profile);
    return true;
  }
  async targets(): Promise<void> {
    const { browser, profile } = this.#instance();
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
    const { browser, profile, target, url } = this.#instance();
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

((globalThis as Record<string, unknown>).cli = CLI.Application).main();