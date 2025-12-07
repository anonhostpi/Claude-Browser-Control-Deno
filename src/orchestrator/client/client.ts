import { Method } from "../contract.ts";

export interface IClient {
  readonly url: string;
}

export class Client implements IClient {
  constructor(url: string | IClient, path?: string) {
    if (typeof url === "string") {
      this.#url = url;
    } else {
      this.#parent = url;
      this.#path = path ?? "";
    }
  }

  #url?: string;
  #parent?: IClient;
  #path?: string;

  get url(): string {
    if (this.#url) return this.#url;
    const parentUrl = this.#parent!.url;
    const base = parentUrl.endsWith("/") ? parentUrl : parentUrl + "/";
    return this.#path ? new URL(this.#path, base).href : parentUrl;
  }
  set url(value: string) {
    this.#url = value;
    this.#parent = undefined;
    this.#path = undefined;
  }

  #full(path?: string): string {
    if (!path) return this.url;
    return new URL(path, this.url.endsWith("/") ? this.url : this.url + "/").href;
  }
  async alive(path?: string, specificCode?: number): Promise<boolean> {
    try {
      const status = (await fetch(
        this.#full(path),
        { method: "HEAD" }
      )).status;
      return specificCode
        ? status === specificCode
        : (status / 100 | 0) === 2; 
    } catch {
      return false;
    }
  }
  
  async simple(
    method: Method,
    path?: string
  ): Promise<unknown> {
    const response = await fetch(
      this.#full(path),
      { method }
    );
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }
  async complex(
    method: Method,
    path?: string | unknown,
    body?: unknown
  ): Promise<unknown>;
  async complex(
    method: Method,
    body?: unknown
  ): Promise<unknown>;
  async complex(
    method: Method,
    pathOrBody?: string | unknown,
    maybeBody?: unknown
  ): Promise<unknown> {
    const path = typeof pathOrBody === "string" ? pathOrBody : undefined;
    const body = typeof pathOrBody === "string" ? maybeBody : pathOrBody;
    return (await fetch(
      this.#full(path),
      {
        method,

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )).json();
  }

  head(path?: string): Promise<void> {
    return this.simple("HEAD", path) as Promise<void>;
  }
  delete(path?: string): Promise<void> {
    return this.simple("DELETE", path) as Promise<void>;
  }
  get(path?: string): Promise<unknown> {
    return this.simple("GET", path);
  }

  put(body?: unknown): Promise<unknown>;
  put(path?: string, body?: unknown): Promise<unknown>;
  put(pathOrBody?: string | unknown, maybeBody?: unknown): Promise<unknown> {
    return this.complex("PUT", pathOrBody, maybeBody);
  }
  patch(body?: unknown): Promise<unknown>;
  patch(path?: string, body?: unknown): Promise<unknown>;
  patch(pathOrBody?: string | unknown, maybeBody?: unknown): Promise<unknown> {
    return this.complex("PATCH", pathOrBody, maybeBody);
  }
  post(body?: unknown): Promise<unknown>;
  post(path?: string, body?: unknown): Promise<unknown>;
  post(pathOrBody?: string | unknown, maybeBody?: unknown): Promise<unknown> {
    return this.complex("POST", pathOrBody, maybeBody);
  }
};