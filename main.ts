/**
 * Claude Browser Control - CLI Entry Point
 */

import { startServer } from "./src/server/mod.ts";
import { ensureServer } from "./src/cli/mod.ts";

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
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

function showHelp(): void {
  console.log(`
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
`);
}

async function runServe(flags: Record<string, string>): Promise<void> {
  const port = flags.port ? parseInt(flags.port) : undefined;
  const parentPid = flags["parent-pid"] ? parseInt(flags["parent-pid"]) : undefined;
  await startServer({ port, parentPid });
}

async function runInfo(): Promise<void> {
  const { client } = await ensureServer();
  const data = await client.listBrowsers() as { browsers: Array<{ type: string; name: string }> };
  
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

async function runLaunch(flags: Record<string, string>): Promise<void> {
  const browser = flags.browser ?? flags.b ?? "chrome";
  const profile = flags.profile ?? flags.p ?? "Claude";
  const headless = "headless" in flags;

  const { client } = await ensureServer();
  const result = await client.launchInstance(browser, profile, { headless });
  console.log(JSON.stringify(result, null, 2));
}

async function runClose(flags: Record<string, string>): Promise<void> {
  const browser = flags.browser ?? flags.b ?? "chrome";
  const profile = flags.profile ?? flags.p ?? "Claude";

  const { client } = await ensureServer();
  await client.closeInstance(browser, profile);
  console.log("Instance closed.");
}

async function runTargets(flags: Record<string, string>): Promise<void> {
  const browser = flags.browser ?? flags.b ?? "chrome";
  const profile = flags.profile ?? flags.p ?? "Claude";

  const { client } = await ensureServer();
  const result = await client.getInstance(browser, profile) as {
    targets: Array<{ id: string; type: string; title: string; url: string }>;
  };
  
  console.log("\n=== Targets ===");
  for (const t of result.targets) {
    console.log(`\n[${t.type}] ${t.id}`);
    console.log(`  Title: ${t.title}`);
    console.log(`  URL: ${t.url}`);
  }
}

async function runNavigate(flags: Record<string, string>): Promise<void> {
  const browser = flags.browser ?? flags.b ?? "chrome";
  const profile = flags.profile ?? flags.p ?? "Claude";
  const target = flags.target ?? flags.t;
  const url = flags.url ?? flags.u;

  if (!target) {
    console.error("Error: --target required");
    Deno.exit(1);
  }
  if (!url) {
    console.error("Error: --url required");
    Deno.exit(1);
  }

  const { client } = await ensureServer();
  await client.navigate(browser, profile, target, url);
  console.log(`Navigated to ${url}`);
}

async function main(): Promise<void> {
  const args = Deno.args;
  const command = args[0];
  const flags = parseFlags(args.slice(1));

  if (flags.h || flags.help) {
    showHelp();
    return;
  }

  switch (command) {
    case "serve":
      await runServe(flags);
      break;
    case "info":
      await runInfo();
      break;
    case "launch":
      await runLaunch(flags);
      break;
    case "close":
      await runClose(flags);
      break;
    case "targets":
      await runTargets(flags);
      break;
    case "navigate":
      await runNavigate(flags);
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      if (!command) {
        showHelp();
      } else {
        console.error(`Unknown command: ${command}`);
        showHelp();
        Deno.exit(1);
      }
  }
}

if (import.meta.main) {
  main();
}
