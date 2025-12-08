import { Endpoint } from "./endpoint.ts";

import { IRootClient, root } from "./core.ts";
import { Root as API } from "../orchestrator/contracts/api.ts";

import { Client } from "../orchestrator/client/mod.ts";

export class Root extends Client implements IRootClient {
  constructor(server: string) {
    super(server);
  }
  health(): Promise<boolean> {
    return this.alive();
  }
  list(): Promise<API.ListResponse> {
    return root.list(this);
  }
  killAll(): Promise<API.KillAllResponse> {
    return root.killAll(this);
  }

  endpoint(name: string): Promise<Endpoint> {
    return Promise.resolve(new Endpoint(this, name));
  }
}