import { Method } from "../contract.ts";
import { CodedError as ResponseError } from "../server/errors.ts";

export { ResponseError };
export interface HasUrl {
  url: string;
  path?: string;
}

export class Client implements HasUrl {
  constructor(url: string | HasUrl, path?: string) {
    if (typeof url === "string") {
      this.#url = url;
    } else {
      this.#parent = url;
      this.#path = path ?? "";
    }
  }

  #url?: string;
  #parent?: HasUrl;
  #path?: string;

  get url(): string {
    if (this.#url) return this.#url;
    const parentUrl = this.#parent!.url;
    const base = parentUrl.endsWith("/") ? parentUrl : parentUrl + "/";
    return this.#path ? new URL(this.#path, base).href : parentUrl;
  }

  get parent(): string | undefined {
    return this.#parent?.url;
  }

  get path(): string {
    if (this.#parent?.path)
      return [this.#parent.path, this.#path].filter(Boolean).join("/");
    return this.#path ?? "";
  }

  #full(path?: string): string {
    if (!path) return this.url;
    return new URL(path, this.url.endsWith("/") ? this.url : this.url + "/").href;
  }
  async alive(path?: string, specificCode?: number): Promise<boolean> {
    try {
      await this.head(path, specificCode);
      return true;
    } catch (error) {
      if (error instanceof ResponseError)
        return false;
      else
        throw error;
    }
  }
  
  async simple(
    method: Method,
    path?: string,
    specificCode?: number
  ): Promise<unknown> {
    const response = await fetch(
      this.#full(path),
      { method }
    );
    const ok = response.ok && (specificCode ? response.status === specificCode : true);
    if (!ok) {
      throw new ResponseError(
        response.statusText,
        response.status
      );
    }
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }
  async complex(
    method: Method,
    path?: string | unknown,
    body?: unknown,
    specificCode?: number
  ): Promise<unknown>;
  async complex(
    method: Method,
    body?: unknown
  ): Promise<unknown>;
  async complex(
    method: Method,
    pathOrBody?: string | unknown,
    maybeBody?: unknown,
    specificCode?: number
  ): Promise<unknown> {
    const path = typeof pathOrBody === "string" ? pathOrBody : undefined;
    const body = typeof pathOrBody === "string" ? maybeBody : pathOrBody;
    const response = await fetch(
      this.#full(path),
      {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const ok = response.ok && (specificCode ? response.status === specificCode : true);
    if (!ok) {
      throw new ResponseError(
        response.statusText,
        response.status
      );
    }
    return response.json();
  }

  head(path?: string, specificCode?: number): Promise<void> {
    return this.simple("HEAD", path, specificCode) as Promise<void>;
  }
  delete(path?: string, specificCode?: number): Promise<void> {
    return this.simple("DELETE", path, specificCode) as Promise<void>;
  }
  get(path?: string, specificCode?: number): Promise<unknown> {
    return this.simple("GET", path, specificCode);
  }

  put(body?: unknown): Promise<unknown>;
  put(path?: string, body?: unknown): Promise<unknown>;
  put(pathOrBody?: string | unknown, maybeBody?: unknown, specificCode?: number): Promise<unknown> {
    return this.complex("PUT", pathOrBody, maybeBody, specificCode);
  }
  patch(body?: unknown): Promise<unknown>;
  patch(path?: string, body?: unknown): Promise<unknown>;
  patch(pathOrBody?: string | unknown, maybeBody?: unknown, specificCode?: number): Promise<unknown> {
    return this.complex("PATCH", pathOrBody, maybeBody, specificCode);
  }
  post(body?: unknown): Promise<unknown>;
  post(path?: string, body?: unknown): Promise<unknown>;
  post(pathOrBody?: string | unknown, maybeBody?: unknown, specificCode?: number): Promise<unknown> {
    return this.complex("POST", pathOrBody, maybeBody, specificCode);
  }
};