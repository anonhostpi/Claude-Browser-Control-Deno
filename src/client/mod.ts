/**
 * Contract-driven Browser Control Client
 *
 * Hierarchical client architecture:
 * - Endpoint: /:endpoint (browser type OR host)
 * - Context: /:endpoint/:context (profile OR port)
 * - Target: /:endpoint/:context/:target (tab/page)
 * - Node: /:endpoint/:context/:target/:node (DOM node)
 *
 * @example
 * ```ts
 * import { Endpoint } from "./client/mod.ts";
 *
 * // Configure server URL (optional, defaults to http://localhost:9333)
 * Endpoint.configure("http://localhost:9333");
 *
 * // Create endpoint client (browser or host)
 * const chrome = new Endpoint("chrome");
 *
 * // Get browser info
 * const info = await chrome.info();
 *
 * // Create a context (launches browser with profile)
 * const ctx = await chrome.context("default");
 *
 * // Create a target (opens a new tab)
 * const target = await ctx.target("https://example.com");
 *
 * // Query DOM nodes
 * const nodes = await target?.xpath("//h1");
 *
 * // Interact with nodes
 * await nodes?.[0]?.click();
 * ```
 */

// Client classes
export { Root } from "./root.ts";
export { Endpoint } from "./endpoint.ts";
export { Context } from "./context.ts";
export { Target } from "./target.ts";
export { Node } from "./node.ts";

// Re-export namespaced types from api.ts for type access
// Usage: import { Endpoint, EndpointTypes } from "./client/mod.ts";
//        const info: EndpointTypes.InfoResponse = await endpoint.info();
export {
  Root as RootTypes,
  Endpoint as EndpointTypes,
  Context as ContextTypes,
  Target as TargetTypes,
  Node as NodeTypes,
} from "../orchestrator/contracts/api.ts";

// Re-export core client types for advanced usage
export { Client, type HasUrl } from "../orchestrator/client/mod.ts";
export { create, type ContractByName } from "../orchestrator/client/utility.ts";
export * from "./core.ts";
