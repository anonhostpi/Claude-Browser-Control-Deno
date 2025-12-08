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
  deno task start <command> [flags] [json-body]

BUILT-IN COMMANDS:
  serve:rest        Start the REST API server
  serve:mcp         Start the MCP server
  contracts         List all available contract commands
  version           Show version number
  location          Show CLI executable path
  help [command]    Show help (optionally for specific command)

CONTRACT COMMANDS (use contract name directly):
  root:health                  Health check
  root:list                    List available browsers
  root:killAll                 Kill all browser instances
  endpoint:exists              Check if endpoint exists (-e)
  endpoint:info                Get browser info/profiles (-e)
  endpoint:launch              Launch browser with default profile (-e)
  endpoint:killAll             Kill all instances of browser type (-e)
  context:exists               Check if context exists (-e -c)
  context:info                 Get context info and targets (-e -c)
  context:create               Launch browser instance (-e -c)
  context:close                Close browser instance (-e -c)
  target:exists                Check if target exists (-e -c -t)
  target:info                  Get target info (-e -c -t)
  target:cdp                   Get WebSocket URL for CDP access (-e -c -t)
  target:control               Control target (navigate, screenshot, etc.) (-e -c -t)
  target:content               Content/document control (permissions, cookies) (-e -c -t)
  target:emulate               Device/viewport emulation (-e -c -t)
  target:throttle              Network/CPU throttling (-e -c -t)
  target:intercept             Request interception (-e -c -t)
  target:label                 Metadata/labeling (-e -c -t)
  target:create                Create new target/tab (-e -c -t)
  target:close                 Close target (-e -c -t)
  node:exists                  Check if node exists (-e -c -t -n)
  node:info                    Get DOM node info (-e -c -t -n)
  node:create                  Create child node (-e -c -t -n)
  node:replace                 Replace node content (-e -c -t -n)
  node:interact                Interact with node (click, type, etc.) (-e -c -t -n)
  node:remove                  Remove node from DOM (-e -c -t -n)

FLAGS:
  -h, --help        Show help
  -s, --server      API server URL (default: http://localhost:9333)
  -e, --endpoint    Browser type (chrome, edge, brave) or host address
  -c, --context     Profile name or port number
  -t, --target      Target ID (tab/page)
  -n, --node        Node ID (DOM element)

SERVE FLAGS:
  -i, --host        Host to bind (default: localhost)
  -p, --port        Port to bind (default: 9333)

REQUEST BODY:
  Pass request options as a JSON string argument after flags.
  Example: '{"headless":true}' or '{"navigate":"https://example.com"}'

EXAMPLES:
  # Start the server
  deno task start serve:rest

  # Start MCP server (uses --server for API URL)
  deno task start serve:mcp -s http://localhost:9333

  # List available browsers
  deno task start root:list

  # Get browser info
  deno task start endpoint:info -e chrome

  # Launch browser with profile (JSON body for options)
  deno task start context:create -e chrome -c Agent '{"headless":false}'

  # Launch headless
  deno task start context:create -e chrome -c Agent '{"headless":true}'

  # Get targets in context
  deno task start context:info -e chrome -c Agent

  # Navigate a target
  deno task start target:control -e chrome -c Agent -t <id> '{"navigate":"https://example.com"}'

  # Click an element
  deno task start node:interact -e chrome -c Agent -t <id> -n <nodeId> '{"click":true}'

  # Close browser instance
  deno task start context:close -e chrome -c Agent
`;

((globalThis as Record<string, unknown>).cli = CLI.create(
  LOCATION, VERSION, USAGE
)).main();
