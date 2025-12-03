/**
 * Tests for OS Detection Module
 */

import { assertEquals, assertExists } from "@std/assert";
import { detectOS, getHomeDir } from "../src/os/mod.ts";

Deno.test("detectOS returns valid platform info", () => {
  const os = detectOS();

  assertExists(os.platform);
  assertExists(os.homeDir);

  // Platform should be one of the valid values
  const validPlatforms = ["windows", "darwin", "linux"];
  assertEquals(validPlatforms.includes(os.platform), true);

  // Boolean flags should be consistent with platform
  if (os.platform === "windows") {
    assertEquals(os.isWindows, true);
    assertEquals(os.isMac, false);
    assertEquals(os.isLinux, false);
  } else if (os.platform === "darwin") {
    assertEquals(os.isWindows, false);
    assertEquals(os.isMac, true);
    assertEquals(os.isLinux, false);
  } else if (os.platform === "linux") {
    assertEquals(os.isWindows, false);
    assertEquals(os.isMac, false);
    assertEquals(os.isLinux, true);
  }
});

Deno.test("getHomeDir returns a non-empty string", () => {
  const homeDir = getHomeDir();

  assertExists(homeDir);
  assertEquals(typeof homeDir, "string");
  assertEquals(homeDir.length > 0, true);
});

Deno.test("detectOS homeDir matches getHomeDir", () => {
  const os = detectOS();
  const homeDir = getHomeDir();

  assertEquals(os.homeDir, homeDir);
});

Deno.test("detectOS localAppData exists on Windows", () => {
  const os = detectOS();

  if (os.isWindows) {
    assertExists(os.localAppData);
    assertEquals(typeof os.localAppData, "string");
  } else {
    assertEquals(os.localAppData, undefined);
  }
});
