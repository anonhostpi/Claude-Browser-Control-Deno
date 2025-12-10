/**
 * MCP Tool Schema Generation.
 *
 * Generates MCP tool schemas from API contracts at runtime.
 */

import { contracts } from "../orchestrator/contracts/api.ts";
import type { JSONObject } from "../orchestrator/schema.ts";
import type { MCPTool } from "./types.ts";

/**
 * Generate MCP tool schemas from contracts.
 */
export function tools(): MCPTool[] {
  const result: MCPTool[] = [];

  for (const contract of contracts) {
    // Check for mcp config using 'in' operator since not all contracts have it
    const mcp = "mcp" in contract ? contract.mcp as { enabled?: boolean; tool?: string; description?: string } : undefined;
    if (mcp?.enabled === false) continue;

    const toolName = mcp?.tool ?? contract.name;
    const description = mcp?.description ?? contract.description;

    const inputSchema: MCPTool["inputSchema"] = { type: "object" as const };

    // Extract path parameters
    const pathParams = contract.path.match(/:(\w+)/g)?.map((p) => p.slice(1)) ?? [];
    const properties: JSONObject = {};

    for (const param of pathParams) {
      properties[param] = { type: "string", description: `Path parameter: ${param}` };
    }

    // Add request body properties if contract has request schema
    if ("request" in contract && contract.request && typeof contract.request === "object") {
      const req = contract.request as { properties?: JSONObject; required?: string[] };
      if (req.properties) {
        Object.assign(properties, req.properties);
      }
    }

    if (Object.keys(properties).length > 0) {
      inputSchema.properties = properties;
    }

    // Required fields = path params + schema required
    const required: string[] = [...pathParams];
    if ("request" in contract && contract.request && typeof contract.request === "object") {
      const req = contract.request as { required?: string[] };
      if (Array.isArray(req.required)) {
        required.push(...req.required.filter((r): r is string => typeof r === "string"));
      }
    }
    if (required.length > 0) {
      inputSchema.required = required;
    }

    result.push({ name: toolName, description, inputSchema });
  }

  return result;
}
