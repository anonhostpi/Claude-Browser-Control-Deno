# Claude-Browser-Control-Deno

A Deno library for controlling Chrome-based browsers via Chrome DevTools Protocol (CDP).

## Features

- **Contract-Driven Architecture**: REST API and CLI commands derived from typed contracts
- **OS Detection**: Automatically detects Windows, macOS, or Linux
- **Browser Discovery**: Finds installed Chrome-based browsers (Chrome, Edge, Brave, Chromium, Vivaldi)
- **Profile Management**: Discovers browser profiles, operates under a dedicated "Agent" profile by default
- **CDP Integration**: Launch browsers with remote debugging and control via CDP WebSocket
- **MCP Server**: Model Context Protocol server for AI agent integration

## Prerequisites

- [Deno](https://deno.land/) v1.40+
- At least one Chrome-based browser installed

## Quick Start

```bash
# Start the REST API server
deno task serve

# List available browsers
deno task start root:list

# Launch browser with profile
deno task start context:create --endpoint chrome --context Agent

# Get targets in browser
deno task start context:info --endpoint chrome --context Agent

# Close browser instance
deno task start context:close --endpoint chrome --context Agent
```

## CLI Commands

### Built-in Commands

| Command | Description |
|---------|-------------|
| `serve` | Start the REST API server |
| `mcp` | Start the MCP server (JSON-RPC over stdio) |
| `contracts` | List all available contract commands |
| `version` | Show version number |
| `help` | Show help message |

### Contract Commands

Contract commands use the format `domain:action` (e.g., `endpoint:info`, `context:create`).

| Command | Description | Required Flags |
|---------|-------------|----------------|
| `root:list` | List available browsers | - |
| `root:killAll` | Kill all browser instances | - |
| `endpoint:info` | Get browser info/profiles | `--endpoint` |
| `endpoint:launch` | Launch browser with default profile | `--endpoint` |
| `endpoint:killAll` | Kill all instances of browser type | `--endpoint` |
| `context:info` | Get context info and targets | `--endpoint --context` |
| `context:create` | Launch browser instance | `--endpoint --context` |
| `context:close` | Close browser instance | `--endpoint --context` |
| `target:info` | Get target info | `--endpoint --context --target` |
| `target:control` | Control target (navigate, screenshot, etc.) | `--endpoint --context --target` |
| `target:create` | Create new target/tab | `--endpoint --context --target` |
| `target:close` | Close target | `--endpoint --context --target` |
| `node:info` | Get DOM node info | `--endpoint --context --target --node` |
| `node:interact` | Interact with node (click, type, etc.) | `--endpoint --context --target --node` |
| `node:remove` | Remove node from DOM | `--endpoint --context --target --node` |

### CLI Options

| Option | Description |
|--------|-------------|
| `--endpoint` | Browser type (chrome, edge, brave) or host address |
| `--context` | Profile name or port number |
| `--target` | Target ID (tab/page) |
| `--node` | Node ID (DOM element) |
| `--server` | API server URL (default: http://localhost:9333) |
| `--headless` | Run browser in headless mode |
| `--help`, `-h` | Show help message |

## Usage as Library

```typescript
import { Endpoint, Context, Target, Client } from "./src/mod.ts";

// Configure server URL (optional, defaults to http://localhost:9333)
Endpoint.configure("http://localhost:9333");

// Create endpoint client (browser type)
const chrome = new Endpoint("chrome");

// Get browser info
const info = await chrome.info();

// Create a context (launches browser with profile)
const ctx = await Context.create(chrome, "Agent");

// Get context info including targets
const ctxInfo = await ctx.info();

// Create a target (opens a new tab)
const target = await ctx.target("https://example.com");

// Query DOM nodes
const nodes = await target?.xpath("//h1");

// Interact with nodes
await nodes?.[0]?.click();

// Close context (browser instance)
await ctx.close();
```

## REST API

The server exposes a REST API at `http://localhost:9333` by default.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `HEAD` | `/` | Health check |
| `GET` | `/` | List available browsers |
| `DELETE` | `/` | Kill all browser instances |
| `GET` | `/:endpoint` | Get browser info or scan host for CDP ports |
| `POST` | `/:endpoint` | Launch browser with default profile |
| `DELETE` | `/:endpoint` | Kill all instances of browser type |
| `GET` | `/:endpoint/:context` | Get context info and targets |
| `POST` | `/:endpoint/:context` | Create context (launch browser) |
| `DELETE` | `/:endpoint/:context` | Close context |
| `GET` | `/:endpoint/:context/:target` | Get target info, WebSocket upgrade for CDP |
| `POST` | `/:endpoint/:context/:target` | Control target or create new tab |
| `PUT` | `/:endpoint/:context/:target` | Update content/settings |
| `DELETE` | `/:endpoint/:context/:target` | Close target |
| `GET` | `/:endpoint/:context/:target/:node` | Get node info |
| `POST` | `/:endpoint/:context/:target/:node` | Create child node |
| `PUT` | `/:endpoint/:context/:target/:node` | Replace node content |
| `PATCH` | `/:endpoint/:context/:target/:node` | Interact with node |
| `DELETE` | `/:endpoint/:context/:target/:node` | Remove node |

## Supported Browsers

- Google Chrome
- Microsoft Edge
- Brave Browser
- Chromium
- Vivaldi

## Deno Tasks

```bash
deno task serve      # Start REST API server
deno task mcp        # Start MCP server
deno task start      # Run CLI with arguments
deno task test       # Run tests
deno task repl       # Start REPL with library loaded
```

## License

MIT
