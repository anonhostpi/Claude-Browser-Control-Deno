/**
 * Tests for Profile Discovery Module
 */

import { assertEquals, assertExists } from "@std/assert";
import { Browser } from "../src/browsers/mod.ts";
import {
  discoverProfiles,
  findProfile,
  getClaudeProfile,
  CLAUDE_PROFILE_NAME,
} from "../src/profiles/mod.ts";

Deno.test("CLAUDE_PROFILE_NAME is 'Claude'", () => {
  assertEquals(CLAUDE_PROFILE_NAME, "Claude");
});

Deno.test("discoverProfiles returns array for valid browser", async () => {
  const browser = Browser.default;
  if (!browser) {
    console.log("Skipping: no browser installed");
    return;
  }

  const profiles = await discoverProfiles(browser);
  assertEquals(Array.isArray(profiles), true);
});

Deno.test("discovered profiles have required properties", async () => {
  const browser = Browser.default;
  if (!browser) {
    console.log("Skipping: no browser installed");
    return;
  }

  const profiles = await discoverProfiles(browser);

  for (const profile of profiles) {
    assertExists(profile.name);
    assertExists(profile.path);
    assertEquals(typeof profile.isDefault, "boolean");
  }
});

Deno.test("findProfile returns null for nonexistent profile", async () => {
  const browser = Browser.default;
  if (!browser) {
    console.log("Skipping: no browser installed");
    return;
  }

  const profile = await findProfile(browser, "nonexistent-profile-12345");
  assertEquals(profile, null);
});

Deno.test("getClaudeProfile returns profile with correct name", async () => {
  const browser = Browser.default;
  if (!browser) {
    console.log("Skipping: no browser installed");
    return;
  }

  const profile = await getClaudeProfile(browser);

  assertExists(profile);
  assertEquals(profile.name, CLAUDE_PROFILE_NAME);
  assertEquals(profile.displayName, CLAUDE_PROFILE_NAME);
  assertEquals(profile.isDefault, false);
});
