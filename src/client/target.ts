import type { Context } from "./context.ts";
import { Node } from "./node.ts";

import { ITargetClient, target } from "./core.ts";
import { Target as API } from "../orchestrator/contracts/api.ts";

import { Client } from "../orchestrator/client/mod.ts";

export class Target extends Client implements ITargetClient {
  constructor(context: Context, id: string) {
    super(context, id);
  }
  exists(): Promise<boolean> {
    return this.alive();
  }
  info(options: API.InfoRequest = {}): Promise<API.InfoResponse> {
    return target.info(this, options);
  }
  cdp(): Promise<API.CdpResponse> {
    return target.cdp(this);
  }
  control(options: API.ControlRequest): Promise<API.ControlResponse> {
    return target.control(this, options);
  }
  create(options: API.CreateRequest): Promise<API.CreateResponse> {
    return target.create(this, options);
  }
  content(options: API.ContentRequest): Promise<API.ContentResponse> {
    return target.content(this, options);
  }
  emulate(options: API.EmulateRequest): Promise<API.EmulateResponse> {
    return target.emulate(this, options);
  }
  throttle(options: API.ThrottleRequest): Promise<API.ThrottleResponse> {
    return target.throttle(this, options);
  }
  intercept(options: API.InterceptRequest): Promise<API.InterceptResponse> {
    return target.intercept(this, options);
  }
  label(options: API.LabelRequest): Promise<API.LabelResponse> {
    return target.label(this, options);
  }
  close(): Promise<void> {
    return target.close(this);
  }

  node(id: number): Promise<Node> {
    return Promise.resolve(new Node(this, id));
  }
}