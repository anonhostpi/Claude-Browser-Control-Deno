import type { Endpoint } from "./endpoint.ts";
import { Target } from "./target.ts";

import { IContextClient, context } from "./core.ts";
import { Context as API } from "../orchestrator/contracts/api.ts";

import { Client } from "../orchestrator/client/mod.ts";

export class Context extends Client implements IContextClient {
  constructor(endpoint: Endpoint, id: string) {
    super(endpoint, id);
  }
  async create(options: API.CreateRequest = { headless: false }): Promise<boolean> {
    return (await context.create(this, options))?.created ?? false;
  }
  exists(): Promise<boolean> {
    return this.alive();
  }
  info(): Promise<API.InfoResponse> {
    return context.info(this);
  }
  close(): Promise<void> {
    return context.close(this);
  }

  target(id: string): Promise<Target> {
    return Promise.resolve(new Target(this, id));
  }
}