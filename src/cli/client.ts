/**
 * CLI Client
 * HTTP client for communicating with the server
 */

import { DEFAULT_SERVER_PORT, DEFAULT_SERVER_HOSTNAME } from "../server/mod.ts";
import type CDP from "chrome-remote-interface";

export class Client {
  #url: string;
  async #status(path?: string): Promise<boolean> {
    try {
      return (await fetch(
        `${this.#url}/${path}`,
        { method: "HEAD" }
      )).status === 204;
    } catch {
      return false;
    }
  }
  async #simple(
    method: string,
    path?: string
  ): Promise<unknown> {
    return (await fetch(
      `${this.#url}/${path}`,
      { method }
    )).json();
  }
  async #complex(
    method: string,
    path?: string,
    body?: unknown
  ): Promise<unknown> {
    return (await fetch(
      `${this.#url}/${path}`,
      {
        method,

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )).json();
  }
  #delete(path?: string): Promise<void> {
    return this.#simple("DELETE", path) as Promise<void>;
  }
  #get(path?: string): Promise<unknown> {
    return this.#simple("GET", path);
  }
  #put(path?: string, body?: unknown): Promise<unknown> {
    return this.#complex("PUT", path, body);
  }
  #patch(path?: string, body?: unknown): Promise<unknown> {
    return this.#complex("PATCH", path, body);
  }

  constructor(config: Partial<CDP.Options> = {}) {
    const hostname = config.host ?? DEFAULT_SERVER_HOSTNAME;
    const port = config.port ?? DEFAULT_SERVER_PORT;
    this.#url = `http://${hostname}:${port}`;
  }

  /** Check if server is alive */
  isAlive(): Promise<boolean> {
    return this.#status();
  }

  /** List browsers */
  listBrowsers(): Promise<unknown> {
    return this.#get();
  }

  /** Get browser info */
  getBrowser(browser: string): Promise<unknown> {
    return this.#get(browser);
  }

  /** Check if instance is running */
  isInstanceRunning(browser: string, profile: string): Promise<boolean> {
    return this.#status(`${browser}/${profile}/`);
  }

  /** Get instance info */
  getInstance(browser: string, profile: string): Promise<unknown> {
    return this.#get(`${browser}/${profile}/`);
  }

  /** Launch instance */
  launchInstance(
    browser: string,
    profile: string,
    options: { headless?: boolean; port?: number } = {}
  ): Promise<unknown> {
    return this.#put(
      `${browser}/${profile}/`,
      { type: "instance", ...options }
    );
  }

  /** Close instance */
  closeInstance(browser: string, profile: string): Promise<void> {
    return this.#delete(`${browser}/${profile}/`);
  }

  /** Create target */
  createTarget(browser: string, profile: string, url?: string): Promise<unknown> {
    return this.#put(
      `${browser}/${profile}/`,
      { type: "target", url }
    );
  }

  /** Get target info */
  getTarget(browser: string, profile: string, target: string): Promise<unknown> {
    return this.#get(`${browser}/${profile}/${target}/`);
  }

  /** Navigate target */
  navigate(browser: string, profile: string, target: string, url: string): Promise<unknown> {
    return this.#put(
      `${browser}/${profile}/${target}/`,
      { url }
    );
  }

  /** Close target */
  closeTarget(browser: string, profile: string, target: string): Promise<void> {
    return this.#delete(`${browser}/${profile}/${target}/`);
  }

  /** Execute CDP command */
  cdp(
    browser: string,
    profile: string,
    target: string,
    method: string,
    params?: unknown
  ): Promise<unknown> {
    return this.#put(
      `${browser}/${profile}/${target}/`,
      { method, params }
    );
  }

  /** Inject script */
  inject(
    browser: string,
    profile: string,
    target: string,
    script: string
  ): Promise<unknown> {
    return this.#patch(
      `${browser}/${profile}/${target}/`,
      { script }
    );
  }

  /** Query nodes by XPath */
  queryXPath(
    browser: string,
    profile: string,
    target: string,
    xpath: string
  ): Promise<unknown> {
    return this.#get(`${browser}/${profile}/${target}/?${new URLSearchParams({ xpath })}`);
  }

  /** Query nodes by CSS selector */
  queryCss(
    browser: string,
    profile: string,
    target: string,
    css: string
  ): Promise<unknown> {
    return this.#get(`${browser}/${profile}/${target}/?${new URLSearchParams({ css })}`);
  }

  /** Check if node exists */
  isNodeExists(
    browser: string,
    profile: string,
    target: string,
    nodeId: string
  ): Promise<boolean> {
    return this.#status(
      `${browser}/${profile}/${target}/${nodeId}/`
    );
  }

  /** Get node info */
  getNode(
    browser: string,
    profile: string,
    target: string,
    nodeId: string
  ): Promise<unknown> {
    return this.#get(`${browser}/${profile}/${target}/${nodeId}/`);
  }

  /** Get node children */
  getNodeChildren(
    browser: string,
    profile: string,
    target: string,
    nodeId: string
  ): Promise<unknown> {
    return this.#get(`${browser}/${profile}/${target}/${nodeId}/?children`);
  }

  /** Interact with node (click, type, setAttribute) */
  interactNode(
    browser: string,
    profile: string,
    target: string,
    nodeId: string,
    action: { click?: boolean; type?: string; setAttribute?: { name: string; value: string } }
  ): Promise<unknown> {
    return this.#patch(
      `${browser}/${profile}/${target}/${nodeId}/`,
      action
    );
  }
}
