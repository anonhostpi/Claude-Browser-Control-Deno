/**
 * CLI Tests
 *
 * Tests for CLI argument parsing, flag handling, and command dispatch.
 */

import { assertEquals, assertExists } from "@std/assert";
import { CLI } from "./cli.ts";
import type { ParsedArgs, FlagMap } from "./types.ts";

// =============================================================================
// Parse Function Tests
// =============================================================================

Deno.test("CLI.parse: parses command as first non-flag argument", () => {
  const result = CLI.parse(["root:health"]);
  assertEquals(result.command, "root:health");
  assertEquals(result.flags, {});
  assertEquals(result.remaining, []);
});

Deno.test("CLI.parse: parses long flags with values", () => {
  const result = CLI.parse(["endpoint:info", "--endpoint", "chrome"]);
  assertEquals(result.command, "endpoint:info");
  assertEquals(result.flags.endpoint, "chrome");
});

Deno.test("CLI.parse: parses long flags with equals syntax", () => {
  const result = CLI.parse(["endpoint:info", "--endpoint=chrome"]);
  assertEquals(result.command, "endpoint:info");
  assertEquals(result.flags.endpoint, "chrome");
});

Deno.test("CLI.parse: parses boolean flags (no value)", () => {
  const result = CLI.parse(["help", "--help"]);
  assertEquals(result.command, "help");
  assertEquals(result.flags.help, true);
});

Deno.test("CLI.parse: parses short flags with values", () => {
  const result = CLI.parse(["endpoint:info", "-e", "chrome"]);
  assertEquals(result.command, "endpoint:info");
  assertEquals(result.flags.endpoint, "chrome");
});

Deno.test("CLI.parse: parses combined short boolean flags", () => {
  const result = CLI.parse(["command", "-ech"]);
  assertEquals(result.command, "command");
  // -e, -c, -h all become boolean true (maps to endpoint, context, help)
  assertEquals(result.flags.endpoint, true);
  assertEquals(result.flags.context, true);
  assertEquals(result.flags.help, true);
});

Deno.test("CLI.parse: parses multiple flags", () => {
  const result = CLI.parse([
    "context:create",
    "-e", "chrome",
    "-c", "Agent",
    "--server", "http://localhost:9333"
  ]);
  assertEquals(result.command, "context:create");
  assertEquals(result.flags.endpoint, "chrome");
  assertEquals(result.flags.context, "Agent");
  assertEquals(result.flags.server, "http://localhost:9333");
});

Deno.test("CLI.parse: handles remaining arguments", () => {
  const result = CLI.parse(["command", "arg1", "arg2"]);
  assertEquals(result.command, "command");
  assertEquals(result.remaining, ["arg1", "arg2"]);
});

Deno.test("CLI.parse: parses JSON object in remaining args", () => {
  const result = CLI.parse(["target:control", "-e", "chrome", '{"navigate":"https://example.com"}']);
  assertEquals(result.command, "target:control");
  assertEquals(result.flags.endpoint, "chrome");
  assertEquals(result.json, { navigate: "https://example.com" });
  assertEquals(result.remaining, []); // JSON object removed from remaining
});

Deno.test("CLI.parse: parses JSON primitives in remaining args", () => {
  const result = CLI.parse(["command", "42", "true", '"hello"']);
  assertEquals(result.command, "command");
  assertEquals(result.remaining, [42, true, "hello"]);
});

Deno.test("CLI.parse: keeps non-JSON strings in remaining", () => {
  const result = CLI.parse(["command", "not-json", "also-not-json"]);
  assertEquals(result.command, "command");
  assertEquals(result.remaining, ["not-json", "also-not-json"]);
});

Deno.test("CLI.parse: handles empty args", () => {
  const result = CLI.parse([]);
  assertEquals(result.command, undefined);
  assertEquals(result.flags, {});
  assertEquals(result.remaining, []);
});

Deno.test("CLI.parse: flag followed by another flag is boolean", () => {
  const result = CLI.parse(["command", "--help", "--server", "url"]);
  assertEquals(result.flags.help, true);
  assertEquals(result.flags.server, "url");
});

Deno.test("CLI.parse: short flag mapping works correctly", () => {
  const result = CLI.parse([
    "serve:rest",
    "-s", "http://localhost:9333",
    "-i", "0.0.0.0",
    "-p", "8080"
  ]);
  assertEquals(result.flags.server, "http://localhost:9333");
  assertEquals(result.flags.host, "0.0.0.0");
  assertEquals(result.flags.port, "8080");
});

Deno.test("CLI.parse: target and node flags work", () => {
  const result = CLI.parse([
    "node:info",
    "-e", "chrome",
    "-c", "Agent",
    "-t", "target-123",
    "-n", "456"
  ]);
  assertEquals(result.flags.endpoint, "chrome");
  assertEquals(result.flags.context, "Agent");
  assertEquals(result.flags.target, "target-123");
  assertEquals(result.flags.node, "456");
});

Deno.test("CLI.parse: only first JSON object is captured", () => {
  const result = CLI.parse(["command", '{"a":1}', '{"b":2}']);
  assertEquals(result.json, { a: 1 });
  // Second JSON object stays in remaining since json is already set
  assertEquals(result.remaining.length, 1);
});

// =============================================================================
// Static Parse Method Customization Tests
// =============================================================================

Deno.test("CLI.parse: is settable/replaceable", () => {
  const originalParse = CLI.parse;

  // Replace with custom parser
  const customParse = (_args: string[]): ParsedArgs => ({
    command: "custom",
    flags: { help: true },
    remaining: [],
    json: undefined
  });

  CLI.parse = customParse;
  const result = CLI.parse(["anything"]);
  assertEquals(result.command, "custom");

  // Restore original
  CLI.parse = originalParse;
});

// =============================================================================
// SHORT_FLAGS Export Tests
// =============================================================================

Deno.test("SHORT_FLAGS: contains expected mappings", async () => {
  const { SHORT_FLAGS } = await import("./types.ts");

  assertEquals(SHORT_FLAGS.help, "h");
  assertEquals(SHORT_FLAGS.server, "s");
  assertEquals(SHORT_FLAGS.endpoint, "e");
  assertEquals(SHORT_FLAGS.context, "c");
  assertEquals(SHORT_FLAGS.target, "t");
  assertEquals(SHORT_FLAGS.node, "n");
  assertEquals(SHORT_FLAGS.host, "i");
  assertEquals(SHORT_FLAGS.port, "p");
});

// =============================================================================
// Type Export Tests
// =============================================================================

Deno.test("types: FlagMap accepts string and boolean values", () => {
  const flags: FlagMap = {
    help: true,
    server: "http://localhost:9333",
    endpoint: "chrome",
  };
  assertExists(flags);
  assertEquals(flags.help, true);
  assertEquals(flags.server, "http://localhost:9333");
});

Deno.test("types: ParsedArgs has correct structure", () => {
  const parsed: ParsedArgs = {
    command: "test",
    flags: { help: true },
    remaining: ["arg1", 42],
    json: { key: "value" }
  };
  assertExists(parsed);
  assertEquals(parsed.command, "test");
});
