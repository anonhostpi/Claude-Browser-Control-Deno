import type { Target } from "./target.ts";

import { INodeClient, node } from "./core.ts";
import { Node as API } from "../orchestrator/contracts/api.ts";

import { Client } from "../orchestrator/client/mod.ts";

export class Node extends Client implements INodeClient {
  constructor(target: Target, id: number) {
    super(target, id.toString());
  }
  exists(): Promise<boolean> {
    return this.alive();
  }
  info(options: API.InfoRequest = {}): Promise<API.InfoResponse> {
    return node.info(this, options);
  }
  replace(options: API.ReplaceRequest): Promise<API.ReplaceResponse> {
    return node.replace(this, options);
  }
  interact(options: API.InteractRequest): Promise<API.InteractResponse> {
    return node.interact(this, options);
  }
  remove(): Promise<void> {
    return node.remove(this);
  }

  async create(options: API.CreateRequest): Promise<Node> {
    const response = await node.create(this, options);
    return new Node({
      url: this.parent!,
    } as Target, response.nodeId);
  }
}