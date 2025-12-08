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
  deno task start <command> [options]

BUILT-IN COMMANDS:
  serve             Start the REST API server
  mcp               Start the MCP server (JSON-RPC over stdio)
  contracts         List all available contract commands
  version           Show version number
  help              Show this help message

CONTRACT COMMANDS (use contract name directly):
  root:health                  Health check
  root:list                    List available browsers
  root:killAll                 Kill all browser instances
  endpoint:exists              Check if endpoint exists (--endpoint)
  endpoint:info                Get browser info/profiles (--endpoint)
  endpoint:launch              Launch browser with default profile (--endpoint)
  endpoint:killAll             Kill all instances of browser type (--endpoint)
  context:exists               Check if context exists (--endpoint --context)
  context:info                 Get context info and targets (--endpoint --context)
  context:create               Launch browser instance (--endpoint --context)
  context:close                Close browser instance (--endpoint --context)
  target:exists                Check if target exists (--endpoint --context --target)
  target:info                  Get target info (--endpoint --context --target)
  target:cdp                   Get WebSocket URL for CDP access
  target:control               Control target (navigate, screenshot, etc.)
  target:content               Content/document control (permissions, cookies)
  target:emulate               Device/viewport emulation (--viewport, --device)
  target:throttle              Network/CPU throttling (--networkPreset, --cpuThrottling)
  target:intercept             Request interception (--blocked, --headers, --mock)
  target:label                 Metadata/labeling (--displayName, --tags, --color)
  target:create                Create new target/tab (--endpoint --context --url)
  target:close                 Close target (--endpoint --context --target)
  node:exists                  Check if node exists (--endpoint --context --target --node)
  node:info                    Get DOM node info (--endpoint --context --target --node)
  node:create                  Create child node
  node:replace                 Replace node content
  node:interact                Interact with node (click, type, etc.)
  node:remove                  Remove node from DOM

PATH PARAMETERS (required based on command):
  --endpoint        Browser type (chrome, edge, brave) or host address
  --context         Profile name or port number
  --target          Target ID (tab/page)
  --node            Node ID (DOM element)

SERVER OPTIONS:
  --port            Server port (default: 9333)
  --parent-pid      Exit when parent PID dies
  --server          API server URL (default: http://localhost:9333)

MCP OPTIONS:
  --api-url         REST API URL (default: http://localhost:9333)

CONTRACT OPTIONS (vary by command, see contracts for details):
  --headless        Run browser in headless mode
  --url             URL to navigate to
  --xpath           XPath query for node selection
  --css             CSS selector for node selection
  --navigate        Navigate to URL
  --click           Click the element
  --type            Text to type into element

EXAMPLES:
  # Start the server
  deno task start serve

  # Start MCP server
  deno task start mcp

  # List available browsers
  deno task start root:list

  # Get browser info
  deno task start endpoint:info --endpoint chrome

  # Launch browser with profile
  deno task start context:create --endpoint chrome --context Agent

  # Launch headless
  deno task start context:create --endpoint chrome --context Agent --headless

  # Get targets in context
  deno task start context:info --endpoint chrome --context Agent

  # Navigate a target
  deno task start target:control --endpoint chrome --context Agent --target <id> --navigate https://example.com

  # Close browser instance
  deno task start context:close --endpoint chrome --context Agent
`;

((globalThis as Record<string, unknown>).cli = CLI.create(
  LOCATION, VERSION, USAGE
)).main();
