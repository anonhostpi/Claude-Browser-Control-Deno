/**
 * Claude Browser Control - CLI Entry Point
 */

import {
  detectOS,
  discoverBrowsers,
  getDefaultBrowser,
  getBrowser,
  getProfile,
  discoverProfiles,
  launchBrowser,
  CDPClient,
} from "./src/mod.ts";

async function showSystemInfo(): Promise<void> {
  const os = detectOS();
  console.log("\n=== System Info ===");
  console.log(`Platform: ${os.platform}`);
  console.log(`Home: ${os.homeDir}`);
  if (os.localAppData) {
    console.log(`LocalAppData: ${os.localAppData}`);
  }
}

async function showBrowsers(): Promise<void> {
  console.log("\n=== Installed Browsers ===");
  const browsers = await discoverBrowsers();
  
  if (browsers.length === 0) {
    console.log("No Chrome-based browsers found.");
    return;
  }

  for (const browser of browsers) {
    console.log(`\n${browser.name} (${browser.type})`);
    console.log(`  Executable: ${browser.executablePath}`);
    console.log(`  User Data: ${browser.userDataDir}`);
    
    const profiles = await discoverProfiles(browser);
    console.log(`  Profiles (${profiles.length}):`);
    for (const profile of profiles) {
      const indicator = profile.isDefault ? " [default]" : "";
      const displayName = profile.displayName !== profile.name 
        ? ` (${profile.displayName})`
        : "";
      console.log(`    - ${profile.name}${displayName}${indicator}`);
    }
  }
}

async function launchAndConnect(
  browserType?: string,
  profileName?: string,
  url?: string
): Promise<void> {
  // Get browser
  const browser = browserType 
    ? await getBrowser(browserType)
    : await getDefaultBrowser();

  if (!browser) {
    console.error("No browser found.");
    Deno.exit(1);
  }

  console.log(`\nUsing browser: ${browser.name}`);

  // Get profile (defaults to "Claude")
  const profile = await getProfile(browser, profileName);
  console.log(`Using profile: ${profile.displayName} (${profile.path})`);

  // Launch browser
  const launched = await launchBrowser({
    browser,
    profile,
    startUrl: url ?? "about:blank",
  });

  console.log(`\nBrowser launched successfully!`);
  console.log(`Debugging port: ${launched.debuggingPort}`);
  console.log(`WebSocket: ${launched.wsEndpoint}`);

  // Connect CDP client
  console.log("\nConnecting CDP client...");
  const cdp = await CDPClient.connect(launched.wsEndpoint);
  console.log("CDP connected!");

  // Get browser version info
  const version = await cdp.send("Browser.getVersion");
  console.log("\nBrowser Version:", version);

  // Keep running until user exits
  console.log("\nBrowser is running. Press Ctrl+C to exit.");
  
  Deno.addSignalListener("SIGINT", async () => {
    console.log("\nClosing browser...");
    cdp.close();
    await launched.close();
    Deno.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

function showHelp(): void {
  console.log(`
Claude Browser Control - Control Chrome-based browsers with Deno

USAGE:
  deno task start [command] [options]

COMMANDS:
  info              Show system info and installed browsers
  launch            Launch a browser with CDP debugging enabled

OPTIONS:
  --browser, -b     Browser type: chrome, edge, brave, chromium, vivaldi
  --profile, -p     Profile name (default: "Claude")
  --url, -u         URL to open on launch
  --help, -h        Show this help message

EXAMPLES:
  deno task start info
  deno task start launch
  deno task start launch --browser edge --profile "Work"
  deno task start launch -b chrome -u https://example.com
`);
}

async function main(): Promise<void> {
  const args = Deno.args;
  const command = args[0];

  // Parse flags
  const flags: Record<string, string> = {};
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      flags[key] = value ?? args[++i] ?? "";
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      flags[key] = args[++i] ?? "";
    }
  }

  // Handle shortcuts
  if (flags.b) flags.browser = flags.b;
  if (flags.p) flags.profile = flags.p;
  if (flags.u) flags.url = flags.u;
  if (flags.h) {
    showHelp();
    return;
  }

  switch (command) {
    case "info":
      await showSystemInfo();
      await showBrowsers();
      break;
    case "launch":
      await launchAndConnect(flags.browser, flags.profile, flags.url);
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
