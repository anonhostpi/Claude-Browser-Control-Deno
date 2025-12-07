/**
 * Orchestrator Client module.
 *
 * Provides HTTP client utilities for communicating with the REST API server.
 *
 * @example
 * ```ts
 * import { Client, create } from "./client/mod.ts";
 * import { contracts } from "./contracts/api.ts";
 *
 * const client = new Client("http://localhost:9333");
 *
 * // Use the low-level client directly
 * const browsers = await client.get("/");
 *
 * // Or create typed functions from contracts
 * const rootList = create(contracts[1]); // root:list
 * const response = await rootList(client);
 * ```
 */

export * from "./client.ts";
export * from "./utility.ts";
