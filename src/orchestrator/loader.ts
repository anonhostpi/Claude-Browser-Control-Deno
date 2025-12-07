/**
 * Contract loader utilities for parsing contracts from various formats.
 *
 * Supports:
 * - JSON (.json)
 * - YAML (.yaml, .yml)
 * - TOML (.toml)
 *
 * All formats support the `$include` directive for importing other contract files:
 * ```yaml
 * contracts:
 *   - $include: "./browser-contracts.yaml"
 *   - $include: "./node-contracts.yaml"
 * ```
 *
 * Includes are resolved relative to the file containing the `$include` directive.
 * Circular includes are detected and will throw an error.
 */

import { parse as parseYaml } from "@std/yaml";
import { parse as parseToml } from "@std/toml";
import { dirname, toFileUrl } from "@std/path";
import type { EndpointContract, Method } from "./contract.ts";
import type { JSONSchema } from "json-schema-to-ts";

/**
 * Contract file structure with optional base override
 */
export interface ContractFile {
  base?: string;
  contracts: EndpointContract[];
}

/**
 * Loaded contracts with resolved base URL
 */
export interface LoadedContracts {
  /** Resolved absolute base URL for module resolution */
  base: string;
  /** Original base from contract file (undefined if not specified) */
  originalBase?: string;
  contracts: EndpointContract[];
}

/**
 * Supported file formats for contract loading
 */
export type Format = "json" | "yaml" | "toml";

/**
 * Detect format from file extension
 */
export function detectFormat(path: string): Format {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "yaml":
    case "yml":
      return "yaml";
    case "toml":
      return "toml";
    case "json":
      return "json";
    default:
      throw new Error(`Unknown file extension: .${ext}`);
  }
}

/**
 * Resolve an include path relative to the current file
 */
function resolveIncludePath(includePath: string, currentFile: string): string {
  if (includePath.startsWith("file://") || includePath.startsWith("http://") || includePath.startsWith("https://")) {
    return includePath;
  }

  const currentUrl = currentFile.startsWith("file://")
    ? currentFile
    : toFileUrl(currentFile).href;
  const currentDir = dirname(currentUrl);
  return new URL(includePath, currentDir + "/").href;
}

/**
 * Convert a file URL to a path for Deno.readTextFile
 */
function urlToPath(url: string): string {
  if (url.startsWith("file://")) {
    // Handle file URLs - extract path
    const urlObj = new URL(url);
    // On Windows, pathname starts with /C:/ which needs to be C:/
    let path = decodeURIComponent(urlObj.pathname);
    if (Deno.build.os === "windows" && path.startsWith("/")) {
      path = path.slice(1);
    }
    return path;
  }
  return url;
}

/**
 * Process includes in parsed data, resolving $include objects
 */
async function processIncludes(
  data: unknown,
  currentFile: string,
  visited: Set<string> = new Set()
): Promise<unknown> {
  // Handle arrays
  if (Array.isArray(data)) {
    const results: unknown[] = [];
    for (const item of data) {
      const processed = await processIncludes(item, currentFile, visited);
      // If the item was an include that returned an array, flatten it
      if (Array.isArray(processed)) {
        results.push(...processed);
      } else {
        results.push(processed);
      }
    }
    return results;
  }

  // Handle objects
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;

    // Check for $include directive
    if ("$include" in obj && typeof obj.$include === "string") {
      const resolvedPath = resolveIncludePath(obj.$include, currentFile);
      const normalizedPath = resolvedPath.startsWith("file://") ? resolvedPath : toFileUrl(resolvedPath).href;

      // Prevent circular includes
      if (visited.has(normalizedPath)) {
        throw new Error(`Circular include detected: ${obj.$include}`);
      }

      const newVisited = new Set(visited);
      newVisited.add(normalizedPath);

      const content = await Deno.readTextFile(urlToPath(resolvedPath));
      const format = detectFormat(obj.$include);
      const parsed = parseRawWithIncludes(content, format);
      return processIncludes(parsed, resolvedPath, newVisited);
    }

    // Process all properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await processIncludes(value, currentFile, visited);
    }
    return result;
  }

  return data;
}

/**
 * Synchronous version of processIncludes
 */
function processIncludesSync(
  data: unknown,
  currentFile: string,
  visited: Set<string> = new Set()
): unknown {
  if (Array.isArray(data)) {
    const results: unknown[] = [];
    for (const item of data) {
      const processed = processIncludesSync(item, currentFile, visited);
      if (Array.isArray(processed)) {
        results.push(...processed);
      } else {
        results.push(processed);
      }
    }
    return results;
  }

  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;

    if ("$include" in obj && typeof obj.$include === "string") {
      const resolvedPath = resolveIncludePath(obj.$include, currentFile);
      const normalizedPath = resolvedPath.startsWith("file://") ? resolvedPath : toFileUrl(resolvedPath).href;

      if (visited.has(normalizedPath)) {
        throw new Error(`Circular include detected: ${obj.$include}`);
      }

      const newVisited = new Set(visited);
      newVisited.add(normalizedPath);

      const content = Deno.readTextFileSync(urlToPath(resolvedPath));
      const format = detectFormat(obj.$include);
      const parsed = parseRawWithIncludes(content, format);
      return processIncludesSync(parsed, resolvedPath, newVisited);
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processIncludesSync(value, currentFile, visited);
    }
    return result;
  }

  return data;
}

/**
 * Parse raw data (internal helper)
 */
function parseRawWithIncludes(content: string, format: Format): unknown {
  switch (format) {
    case "json":
      return JSON.parse(content);
    case "yaml":
      return parseYaml(content);
    case "toml":
      return parseToml(content);
  }
}

/**
 * Parse raw data, detecting if it's a ContractFile or array of contracts
 */
function parseRaw(content: string, format: Format): { base?: string; contracts: unknown[] } {
  const data = parseRawWithIncludes(content, format);
  return extractContracts(data);
}

/**
 * Extract contracts from parsed data structure
 */
function extractContracts(data: unknown): { base?: string; contracts: unknown[] } {
  // Check for ContractFile structure (has 'contracts' array)
  if (
    typeof data === "object" &&
    data !== null &&
    "contracts" in data &&
    Array.isArray((data as ContractFile).contracts)
  ) {
    const file = data as ContractFile;
    return { base: file.base, contracts: file.contracts };
  }

  // Otherwise treat as array or single contract
  const contracts = Array.isArray(data) ? data : [data];
  return { contracts };
}

/**
 * Parse contract data from a string in the specified format
 */
export function parse(content: string, format: Format): EndpointContract[] {
  const { contracts } = parseRaw(content, format);
  return contracts.map(validateContract);
}

/**
 * Get the default base URL from Deno.mainModule
 * Falls back to the current working directory if mainModule is not available
 */
export function getDefaultBase(): string {
  try {
    // Deno.mainModule gives us the URL of the main entry point
    const mainModule = Deno.mainModule;
    return dirname(mainModule) + "/";
  } catch {
    // Fallback to cwd as file URL
    return toFileUrl(Deno.cwd()).href + "/";
  }
}

/**
 * Resolve a base URL, handling relative paths
 */
function resolveBase(base: string | undefined, contractPath: string): string {
  if (!base) {
    return getDefaultBase();
  }

  // If base is already a URL, use it directly
  if (base.startsWith("file://") || base.startsWith("http://") || base.startsWith("https://")) {
    return base.endsWith("/") ? base : base + "/";
  }

  // If base is relative, resolve it relative to the contract file
  const contractUrl = contractPath.startsWith("file://")
    ? contractPath
    : toFileUrl(contractPath).href;
  const contractDir = dirname(contractUrl);
  return new URL(base, contractDir + "/").href;
}

/**
 * Load contracts from a file (simple, without base resolution)
 * Supports !include (YAML) and $include (JSON/TOML) for importing other files.
 */
export async function load(path: string, format?: Format): Promise<EndpointContract[]> {
  const content = await Deno.readTextFile(path);
  const detectedFormat = format ?? detectFormat(path);
  const parsed = parseRawWithIncludes(content, detectedFormat);
  const processed = await processIncludes(parsed, path);
  const { contracts } = extractContracts(processed);
  return contracts.map(validateContract);
}

/**
 * Load contracts from a file synchronously (simple, without base resolution)
 * Supports !include (YAML) and $include (JSON/TOML) for importing other files.
 */
export function loadSync(path: string, format?: Format): EndpointContract[] {
  const content = Deno.readTextFileSync(path);
  const detectedFormat = format ?? detectFormat(path);
  const parsed = parseRawWithIncludes(content, detectedFormat);
  const processed = processIncludesSync(parsed, path);
  const { contracts } = extractContracts(processed);
  return contracts.map(validateContract);
}

/**
 * Load contracts with resolved base URL
 * Supports !include (YAML) and $include (JSON/TOML) for importing other files.
 *
 * Base resolution priority:
 * 1. Explicit `base` field in the contract file
 * 2. Deno.mainModule directory (the entry point of your app)
 * 3. Current working directory (fallback)
 */
export async function loadWithBase(path: string, format?: Format): Promise<LoadedContracts> {
  const content = await Deno.readTextFile(path);
  const detectedFormat = format ?? detectFormat(path);
  const parsed = parseRawWithIncludes(content, detectedFormat);
  const processed = await processIncludes(parsed, path);
  const { base: fileBase, contracts } = extractContracts(processed);

  return {
    base: resolveBase(fileBase, path),
    originalBase: fileBase,
    contracts: contracts.map(validateContract),
  };
}

/**
 * Load contracts with resolved base URL (synchronous)
 * Supports !include (YAML) and $include (JSON/TOML) for importing other files.
 */
export function loadWithBaseSync(path: string, format?: Format): LoadedContracts {
  const content = Deno.readTextFileSync(path);
  const detectedFormat = format ?? detectFormat(path);
  const parsed = parseRawWithIncludes(content, detectedFormat);
  const processed = processIncludesSync(parsed, path);
  const { base: fileBase, contracts } = extractContracts(processed);

  return {
    base: resolveBase(fileBase, path),
    originalBase: fileBase,
    contracts: contracts.map(validateContract),
  };
}

const VALID_METHODS: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

/**
 * Validate and normalize a contract object
 */
function validateContract(data: unknown): EndpointContract {
  if (typeof data !== "object" || data === null) {
    throw new Error("Contract must be an object");
  }

  const obj = data as Record<string, unknown>;

  // Required fields
  if (typeof obj.name !== "string") {
    throw new Error("Contract must have a 'name' string");
  }
  if (typeof obj.path !== "string") {
    throw new Error("Contract must have a 'path' string");
  }
  if (typeof obj.method !== "string" || !VALID_METHODS.includes(obj.method as Method)) {
    throw new Error(`Contract must have a valid 'method': ${VALID_METHODS.join(", ")}`);
  }
  if (typeof obj.module !== "string") {
    throw new Error("Contract must have a 'module' string");
  }
  if (typeof obj.response !== "object" || obj.response === null) {
    throw new Error("Contract must have a 'response' schema object");
  }

  // Optional fields with defaults
  const description = typeof obj.description === "string" ? obj.description : "";

  return {
    name: obj.name,
    path: obj.path,
    method: obj.method as Method,
    description,
    module: obj.module,
    response: obj.response as JSONSchema,
    request: obj.request as JSONSchema | undefined,
    error: obj.error as JSONSchema | undefined,
  };
}
