import type { Root } from "./root.ts";
import { Context } from "./context.ts";

import { IEndpointClient, endpoint } from "./core.ts";
import { Endpoint as API } from "../orchestrator/contracts/api.ts";

import { Client } from "../orchestrator/client/mod.ts";

export class Endpoint extends Client implements IEndpointClient {
  constructor(root: Root, name: string) {
    super(root, name);
  }
  exists(): Promise<boolean> {
    return this.alive();
  }
  info(options: API.InfoRequest): Promise<API.InfoResponse> {
    return endpoint.info(this, options);
  }
  launch(options: API.LaunchRequest): Promise<API.LaunchResponse> {
    return endpoint.launch(this, options);
  }
  killAll(): Promise<API.KillAllResponse> {
    return endpoint.killAll(this);
  }

  async context(id: string): Promise<Context> {
    const context = new Context(this, id);
    if (!(await context.exists()) && !(await context.create()))
      throw new Error(`Failed to create or fetch context with id: ${id}`);
    return context;
  }
}