/**
 * Tests for Browser Discovery Module
 */

import { assertEquals, assertExists } from "@std/assert";
import {
  Browser,
  Type,
  getDefaultBrowser,
  BROWSER_CONFIGS,
} from "../src/browsers/mod.ts";

Deno.test("BROWSER_CONFIGS has expected browsers", () => {
  const browserTypes = BROWSER_CONFIGS.map((c) => c.type);

  assertEquals(browserTypes.includes("chrome"), true);
  assertEquals(browserTypes.includes("edge"), true);
  assertEquals(browserTypes.includes("brave"), true);
  assertEquals(browserTypes.includes("chromium"), true);
  assertEquals(browserTypes.includes("vivaldi"), true);
});

Deno.test("BROWSER_CONFIGS have paths for all platforms", () => {
  for (const config of BROWSER_CONFIGS) {
    assertExists(config.paths.windows);
    assertExists(config.paths.darwin);
    assertExists(config.paths.linux);

    // Each platform should have executables and userDataDir
    assertExists(config.paths.windows.executables);
    assertExists(config.paths.windows.user_data);
    assertExists(config.paths.darwin.executables);
    assertExists(config.paths.darwin.user_data);
    assertExists(config.paths.linux.executables);
    assertExists(config.paths.linux.user_data);
  }
});

Deno.test("Browser.discover returns an array", async () => {
  const browsers = await Browser.discover();

  assertEquals(Array.isArray(browsers), true);
});

Deno.test("discovered browsers have required properties", async () => {
  const browsers = await Browser.discover();

  for (const browser of browsers) {
    assertExists(browser.type);
    assertExists(browser.name);
    assertExists(browser.executable);
    assertExists(browser.user_data);
    assertEquals(browser.installed, true);
  }
});

Deno.test("getDefaultBrowser returns a browser or null", async () => {
  const browser = await getDefaultBrowser();

  // May be null if no browsers installed, but if present should be valid
  if (browser) {
    assertExists(browser.type);
    assertExists(browser.name);
    assertExists(browser.executable);
  }
});

Deno.test("Browser.get returns null for unknown browser type", async () => {
  const browser = await Browser.get("nonexistent-browser" as Type);
  assertEquals(browser, null);
});

Deno.test("Browser.get returns browser for valid types", async () => {
  // Test with chrome - may or may not be installed
  const chrome = await Browser.get("chrome");

  if (chrome) {
    assertEquals(chrome.type, "chrome");
    assertEquals(chrome.name, "Google Chrome");
  }
});
