/**
 * Claude Browser Control - CLI Entry Point
 */

import { CLI } from "./src/cli/cli.ts";
import { parse } from "@std/jsonc";

if (!import.meta.main)
  throw new Error("main.ts should be run as a command.");

const LOCATION = import.meta.dirname as string;

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

((globalThis as Record<string, unknown>).cli = CLI.create(
  LOCATION, VERSION, USAGE
)).main();