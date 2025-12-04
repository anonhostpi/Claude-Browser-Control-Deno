/**
 * CLI Client
 * HTTP client for communicating with the server
 */

import { DEFAULT_SERVER_PORT, DEFAULT_SERVER_HOSTNAME } from "../server/mod.ts";

export interface ClientConfig {
  hostname: string;
  port: number;
}

export class Client {
  private baseUrl: string;

  constructor(config: Partial<ClientConfig> = {}) {
    const hostname = config.hostname ?? DEFAULT_SERVER_HOSTNAME;
    const port = config.port ?? DEFAULT_SERVER_PORT;
    this.baseUrl = `http://${hostname}:${port}`;
  }

  /** Check if server is alive */
  async isAlive(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/`, { method: "HEAD" });
      return res.status === 204;
    } catch {
      return false;
    }
  }

  /** List browsers */
  async listBrowsers(): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/`);
    return res.json();
  }

  /** Get browser info */
  async getBrowser(browser: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/`);
    return res.json();
  }

  /** Check if instance is running */
  async isInstanceRunning(browser: string, profile: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/`, { method: "HEAD" });
    return res.status === 204;
  }

  /** Get instance info */
  async getInstance(browser: string, profile: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/`);
    return res.json();
  }

  /** Launch instance */
  async launchInstance(
    browser: string,
    profile: string,
    options: { headless?: boolean; port?: number } = {}
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "instance", ...options }),
    });
    return res.json();
  }

  /** Close instance */
  async closeInstance(browser: string, profile: string): Promise<void> {
    await fetch(`${this.baseUrl}/${browser}/${profile}/`, { method: "DELETE" });
  }

  /** Create target */
  async createTarget(browser: string, profile: string, url?: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "target", url }),
    });
    return res.json();
  }

  /** Get target info */
  async getTarget(browser: string, profile: string, target: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/${target}/`);
    return res.json();
  }

  /** Navigate target */
  async navigate(browser: string, profile: string, target: string, url: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/${target}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return res.json();
  }

  /** Close target */
  async closeTarget(browser: string, profile: string, target: string): Promise<void> {
    await fetch(`${this.baseUrl}/${browser}/${profile}/${target}/`, { method: "DELETE" });
  }

  /** Execute CDP command */
  async cdp(
    browser: string,
    profile: string,
    target: string,
    method: string,
    params?: unknown
  ): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/${target}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params }),
    });
    return res.json();
  }

  /** Inject script */
  async inject(browser: string, profile: string, target: string, script: string): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/${browser}/${profile}/${target}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script }),
    });
    return res.json();
  }
}
