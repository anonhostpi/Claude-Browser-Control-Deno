# Claude-Browser-Control-Deno

A Deno library for controlling Chrome-based browsers via Chrome DevTools Protocol (CDP).

## Features

- **OS Detection**: Automatically detects Windows, macOS, or Linux
- **Browser Discovery**: Finds installed Chrome-based browsers (Chrome, Edge, Brave, Chromium, Vivaldi)
- **Profile Management**: Discovers browser profiles, operates under a dedicated "Claude" profile by default
- **CDP Integration**: Launch browsers with remote debugging and control via CDP WebSocket

## Prerequisites

- [Deno](https://deno.land/) v1.40+
- At least one Chrome-based browser installed

## Quick Start

```bash
# Show system info and installed browsers
deno task info

# Launch browser with CDP debugging (uses default browser + Claude profile)
deno task launch

# Launch specific browser with specific profile
deno task start launch --browser edge --profile "Default"

# Open a URL
deno task start launch --url https://example.com
```

## Usage as Library

```typescript
import {
  Browser,

  getProfile,
  launchBrowser,
  CDP,
} from "./src/mod.ts";

// Discover browsers
const browsers = Browser.discover();
console.log("Installed browsers:", browsers.map(b => b.name));

// Get default browser
const browser = Browser.default;

// Get Claude profile (creates if needed)
const profile = await getProfile(browser);

// Launch with CDP
const launched = await launchBrowser({
  browser,
  profile,
  startUrl: "https://example.com",
});

// Connect CDP client
const cdp = await CDP(launched.wsEndpoint);

// Navigate to a page
await cdp.send("Page.navigate", { url: "https://example.com" });

// Clean up
cdp.close();
await launched.close();
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `info` | Show system info and installed browsers |
| `launch` | Launch browser with CDP debugging |
| `help` | Show help message |

## CLI Options

| Option | Short | Description |
|--------|-------|-------------|
| `--browser` | `-b` | Browser type: chrome, edge, brave, chromium, vivaldi |
| `--profile` | `-p` | Profile name (default: "Claude") |
| `--url` | `-u` | URL to open on launch |
| `--help` | `-h` | Show help message |

## Supported Browsers

- Google Chrome
- Microsoft Edge
- Brave Browser
- Chromium
- Vivaldi

## Deno REPL Usage

Start the REPL with the library pre-loaded:

```bash
deno task repl
```

Then use the imported `browser` namespace:

```typescript
> const browsers = await browser.Browser.discover()
> console.log(browsers)
```

or use the exports directly:

```typescript
> const browsers = await Browser.discover()
> console.log(browsers)
```

## License

MIT
