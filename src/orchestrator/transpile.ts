/**
 * Transpile utilities for contracts.
 *
 * Provides functions to:
 * - Convert contracts from YAML/TOML to JSON
 * - Generate TypeScript modules with full type inference
 * - Generate MCP tool schemas for Model Context Protocol integration
 * - Resolve all $include directives
 * - Output a single flattened file
 */

import { loadWithBase, loadWithBaseSync, type LoadedContracts } from "./loader.ts";
import type { EndpointContract } from "./contract.ts";
import { resolve } from "@std/path";

/**
 * MCP Tool schema as defined by the Model Context Protocol
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Transpile options
 */
export interface TranspileOptions {
  /** Output path for the generated file */
  output?: string;
  /** Pretty print the output (for JSON) */
  pretty?: boolean;
  /** Output format: 'json' for data, 'ts' for TypeScript module with type inference */
  format?: "json" | "ts";
}

/**
 * Transpile result
 */
export interface TranspileResult {
  /** The loaded and resolved contracts */
  contracts: LoadedContracts;
  /** The output string (JSON or TypeScript) */
  content: string;
  /** The output file path (if written) */
  outputPath?: string;
  /** For backwards compatibility */
  json: string;
  /** MCP tool schemas generated from contracts with mcp config */
  mcpTools: MCPTool[];
}

/**
 * Generate MCP tool schemas from contracts.
 * Only generates tools for contracts that have mcp config (or all if mcp.enabled !== false).
 */
function generateMCPTools(contracts: EndpointContract[]): MCPTool[] {
  const tools: MCPTool[] = [];

  for (const contract of contracts) {
    // Skip contracts without mcp config or with mcp.enabled === false
    if (contract.mcp?.enabled === false) continue;

    // Generate tool name: use mcp.tool if specified, otherwise convert contract name
    // e.g., "target:control" -> "target_control"
    const toolName = contract.mcp?.tool ?? contract.name.replace(/:/g, "_");

    // Use mcp.description if specified, otherwise use contract description
    const description = contract.mcp?.description ?? contract.description;

    // Build input schema from request schema
    // MCP tools use JSON Schema for input validation
    const inputSchema: MCPTool["inputSchema"] = {
      type: "object" as const,
    };

    if (contract.request && typeof contract.request === "object") {
      const req = contract.request as Record<string, unknown>;

      // Add path parameters as additional properties
      const pathParams = contract.path.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? [];

      // Merge path params into properties
      const properties: Record<string, unknown> = {};
      for (const param of pathParams) {
        properties[param] = { type: "string", description: `Path parameter: ${param}` };
      }

      // Add request body properties
      if (req.properties && typeof req.properties === "object") {
        Object.assign(properties, req.properties);
      }

      if (Object.keys(properties).length > 0) {
        inputSchema.properties = properties;
      }

      // Combine required fields
      const required: string[] = [...pathParams]; // Path params are always required
      if (Array.isArray(req.required)) {
        required.push(...req.required.filter((r): r is string => typeof r === "string"));
      }
      if (required.length > 0) {
        inputSchema.required = required;
      }
    } else {
      // No request body, but still need path parameters
      const pathParams = contract.path.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? [];
      if (pathParams.length > 0) {
        inputSchema.properties = {};
        for (const param of pathParams) {
          inputSchema.properties[param] = { type: "string", description: `Path parameter: ${param}` };
        }
        inputSchema.required = pathParams;
      }
    }

    tools.push({
      name: toolName,
      description,
      inputSchema,
    });
  }

  return tools;
}

/**
 * Parse contract name into namespace and action parts.
 * e.g., "target:info" -> { namespace: "Target", action: "Info" }
 *       "root:killAll" -> { namespace: "Root", action: "KillAll" }
 */
function parseContractName(name: string): { namespace: string; action: string } {
  const parts = name.split(":");
  if (parts.length !== 2) {
    // Fallback for names without colon
    return { namespace: "Default", action: toPascalCase(name) };
  }
  return {
    namespace: toPascalCase(parts[0]),
    action: toPascalCase(parts[1]),
  };
}

/**
 * Convert a string to PascalCase.
 * e.g., "killAll" -> "KillAll", "info" -> "Info"
 */
function toPascalCase(name: string): string {
  return name
    .split(/[\-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Group contracts by their namespace.
 */
function groupByNamespace(
  contractList: EndpointContract[]
): Map<string, { contract: EndpointContract; action: string }[]> {
  const groups = new Map<string, { contract: EndpointContract; action: string }[]>();

  for (const contract of contractList) {
    const { namespace, action } = parseContractName(contract.name);
    if (!groups.has(namespace)) {
      groups.set(namespace, []);
    }
    groups.get(namespace)!.push({ contract, action });
  }

  return groups;
}

/**
 * Generate TypeScript module content from contracts.
 * The generated module exports contracts with `as const` for full type inference,
 * plus namespaced types for easy access (e.g., Target.InfoResponse, Node.InteractRequest).
 */
function generateTypeScript(contracts: LoadedContracts): string {
  const lines: string[] = [
    "// deno-lint-ignore-file no-namespace",
    "/**",
    " * Auto-generated contract definitions.",
    " * DO NOT EDIT - Generated by orchestrator/transpile.ts",
    " *",
    " * Exports:",
    " *   - contracts: readonly array of all contracts",
    " *   - Namespaced types: e.g., Target.InfoContract, Target.InfoResponse",
    " */",
    "",
    "import type { FromSchema } from \"../schema.ts\";",
    "import type { ContractByName } from \"../client/utility.ts\";",
    "import type { Client } from \"../client/client.ts\";",
    "import { create as _create } from \"../client/utility.ts\";",
    "",
  ];

  // Only include base if it was explicitly specified in the contract file
  // This avoids leaking absolute file paths into generated output
  if (contracts.originalBase !== undefined) {
    lines.push(`export const base = ${JSON.stringify(contracts.originalBase)} as const;`);
    lines.push("");
  }

  lines.push("export const contracts = [");

  for (const contract of contracts.contracts) {
    lines.push("  {");
    lines.push(`    name: ${JSON.stringify(contract.name)},`);
    lines.push(`    path: ${JSON.stringify(contract.path)},`);
    lines.push(`    method: ${JSON.stringify(contract.method)},`);
    lines.push(`    description: ${JSON.stringify(contract.description)},`);
    lines.push(`    module: ${JSON.stringify(contract.module)},`);
    if (contract.request) {
      lines.push(`    request: ${JSON.stringify(contract.request, null, 2).split("\n").join("\n    ")},`);
    }
    lines.push(`    response: ${JSON.stringify(contract.response, null, 2).split("\n").join("\n    ")},`);
    if (contract.error) {
      lines.push(`    error: ${JSON.stringify(contract.error, null, 2).split("\n").join("\n    ")},`);
    }
    if (contract.mcp) {
      lines.push(`    mcp: ${JSON.stringify(contract.mcp, null, 2).split("\n").join("\n    ")},`);
    }
    if (contract.websocket) {
      lines.push(`    websocket: true,`);
    }
    lines.push("  } as const,");
  }

  lines.push("] as const;");
  lines.push("");
  lines.push("export type Contracts = typeof contracts;");
  lines.push("export type Contract = Contracts[number];");
  lines.push("");

  // Group contracts by namespace and generate namespaced types
  const groups = groupByNamespace(contracts.contracts);

  for (const [namespace, items] of groups) {
    lines.push(`// ${namespace} types and contracts`);
    lines.push(`export namespace ${namespace} {`);

    // First generate all type aliases
    for (const { contract, action } of items) {
      // Contract type alias
      lines.push(`  export type ${action}Contract = ContractByName<Contracts, "${contract.name}">;`);

      // Response type (if not null)
      if (contract.response && (contract.response as { type?: string }).type !== "null") {
        lines.push(`  export type ${action}Response = FromSchema<${action}Contract["response"]>;`);
      }

      // Request type (if present)
      if (contract.request) {
        lines.push(`  export type ${action}Request = FromSchema<${action}Contract["request"]>;`);
      }
    }

    // Then generate contract instances
    lines.push("");
    lines.push("  // Contract instances");
    for (const { contract, action } of items) {
      const lowerAction = action.charAt(0).toLowerCase() + action.slice(1);
      lines.push(
        `  export const ${lowerAction} = contracts.find((c): c is ${action}Contract => c.name === "${contract.name}")!;`
      );
    }

    // Generate miniclient factory function
    lines.push("");
    lines.push("  // Factory function for lazy utility creation");
    lines.push("  // deno-lint-ignore explicit-function-return-type");
    lines.push("  export function miniclient() {");
    lines.push("    return {");
    for (const { contract, action } of items) {
      const lowerAction = action.charAt(0).toLowerCase() + action.slice(1);
      // Determine return type based on response schema
      const hasResponse = contract.response && (contract.response as { type?: string }).type !== "null";
      const returnType = hasResponse ? `${action}Response` : "void";

      if (contract.request) {
        // Has request schema -> required parameter
        lines.push(`      ${lowerAction}: _create(${lowerAction}) as unknown as (client: Client, request: ${action}Request) => Promise<${returnType}>,`);
      } else {
        // No request schema -> no request parameter
        lines.push(`      ${lowerAction}: _create(${lowerAction}) as unknown as (client: Client) => Promise<${returnType}>,`);
      }
    }
    lines.push("    };");
    lines.push("  }");

    // Generate Binding type - keys are full contract names, values are non-nullable
    lines.push("");
    lines.push("  // Type for building handler/binding objects with full contract names as keys");
    lines.push("  export type Binding<Value = unknown> = {");
    for (const { contract } of items) {
      lines.push(`    "${contract.name}": NonNullable<Value>;`);
    }
    lines.push("  };");

    // Generate AssertBinding type for compile-time validation
    lines.push("");
    lines.push("  // Compile-time assertion that a type extends Binding");
    lines.push("  export type AssertBinding<T extends Binding<Value>, Value = unknown> = T;");

    // Generate FullBinding type - Binding plus the base namespace key
    lines.push("");
    lines.push("  // Binding with the base namespace key included");
    lines.push("  export type FullBinding<Value = unknown> = Binding<Value> & {");
    lines.push(`    "${namespace.toLowerCase()}": NonNullable<Value>;`);
    lines.push("  };");

    // Generate AssertFullBinding type for compile-time validation
    lines.push("");
    lines.push("  // Compile-time assertion that a type extends FullBinding");
    lines.push("  export type AssertFullBinding<T extends FullBinding<Value>, Value = unknown> = T;");

    // Generate MiniBinding type - keys are just action names
    lines.push("");
    lines.push("  // Binding with just action names as keys");
    lines.push("  // Meant to be used as an interface to ensure clients fully implement the associated contracts.");
    lines.push("  export type MiniBinding<Value = unknown> = {");
    for (const { action } of items) {
      const lowerAction = action.charAt(0).toLowerCase() + action.slice(1);
      lines.push(`    "${lowerAction}": NonNullable<Value>;`);
    }
    lines.push("  };");

    // Generate AssertMiniBinding type for compile-time validation
    lines.push("");
    lines.push("  // Compile-time assertion that a type extends MiniBinding");
    lines.push("  export type AssertMiniBinding<T extends MiniBinding<Value>, Value = unknown> = T;");

    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Transpile contracts from a source file.
 *
 * This function:
 * 1. Loads contracts from the source file (YAML, TOML, or JSON)
 * 2. Resolves all $include directives
 * 3. Outputs a flattened file (JSON or TypeScript)
 *
 * When format is 'ts', generates a TypeScript module with `as const` assertions
 * for full type inference with `json-schema-to-ts`.
 *
 * @param sourcePath - Path to the source contract file
 * @param options - Transpile options
 * @returns Transpile result with contracts and output content
 */
export async function transpile(
  sourcePath: string,
  options: TranspileOptions = {}
): Promise<TranspileResult> {
  const { output, pretty = true, format = "json" } = options;

  // Load and resolve all includes
  const contracts = await loadWithBase(sourcePath);

  let content: string;
  if (format === "ts") {
    content = generateTypeScript(contracts);
  } else {
    // Only include base if it was explicitly specified in the contract file
    const jsonData: { base?: string; contracts: typeof contracts.contracts } = {
      contracts: contracts.contracts,
    };
    if (contracts.originalBase !== undefined) {
      jsonData.base = contracts.originalBase;
    }
    content = pretty
      ? JSON.stringify(jsonData, null, 2)
      : JSON.stringify(jsonData);
  }

  // Generate MCP tool schemas
  const mcpTools = generateMCPTools(contracts.contracts);

  // Write output if path provided
  let outputPath: string | undefined;
  if (output) {
    outputPath = output;
    await Deno.writeTextFile(output, content);
  }

  return {
    contracts,
    content,
    json: content, // backwards compatibility
    outputPath,
    mcpTools,
  };
}

/**
 * Synchronous version of transpile
 */
export function transpileSync(
  sourcePath: string,
  options: TranspileOptions = {}
): TranspileResult {
  const { output, pretty = true, format = "json" } = options;

  // Load and resolve all includes synchronously
  const contracts = loadWithBaseSync(sourcePath);

  let content: string;
  if (format === "ts") {
    content = generateTypeScript(contracts);
  } else {
    // Only include base if it was explicitly specified in the contract file
    const jsonData: { base?: string; contracts: typeof contracts.contracts } = {
      contracts: contracts.contracts,
    };
    if (contracts.originalBase !== undefined) {
      jsonData.base = contracts.originalBase;
    }
    content = pretty
      ? JSON.stringify(jsonData, null, 2)
      : JSON.stringify(jsonData);
  }

  // Generate MCP tool schemas
  const mcpTools = generateMCPTools(contracts.contracts);

  // Write output if path provided
  let outputPath: string | undefined;
  if (output) {
    outputPath = output;
    Deno.writeTextFileSync(output, content);
  }

  return {
    contracts,
    content,
    json: content, // backwards compatibility
    outputPath,
    mcpTools,
  };
}

/**
 * Generate a default output path based on the source path.
 * Replaces the extension with the specified format extension.
 */
export function getDefaultOutputPath(sourcePath: string, format: "json" | "ts" = "json"): string {
  const ext = sourcePath.split(".").pop();
  if (!ext) return sourcePath + "." + format;
  return sourcePath.slice(0, -ext.length) + format;
}

/**
 * CLI entry point for transpiling contracts.
 *
 * Usage: deno run --allow-read --allow-write transpile.ts [--ts] <source> [output]
 */
if (import.meta.main) {
  const args = [...Deno.args];

  // Check for --ts flag
  let format: "json" | "ts" = "json";
  const tsIndex = args.indexOf("--ts");
  if (tsIndex !== -1) {
    format = "ts";
    args.splice(tsIndex, 1);
  }

  if (args.length < 1) {
    console.error("Usage: deno run --allow-read --allow-write transpile.ts [--ts] <source> [output]");
    console.error("");
    console.error("Options:");
    console.error("  --ts    - Output TypeScript module instead of JSON");
    console.error("");
    console.error("Arguments:");
    console.error("  source  - Path to the source contract file (YAML, TOML, or JSON)");
    console.error("  output  - Optional output path (defaults to source with .json/.ts extension)");
    Deno.exit(1);
  }

  const sourcePath = resolve(args[0]);
  const outputPath = args[1] ? resolve(args[1]) : getDefaultOutputPath(sourcePath, format);

  try {
    const result = await transpile(sourcePath, { output: outputPath, format });
    console.log(`Transpiled ${result.contracts.contracts.length} contracts`);
    console.log(`Format: ${format === "ts" ? "TypeScript" : "JSON"}`);
    console.log(`Output: ${result.outputPath}`);
  } catch (error) {
    console.error("Transpile failed:", (error as Error).message);
    Deno.exit(1);
  }
}
