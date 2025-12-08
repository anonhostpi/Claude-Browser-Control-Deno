import { Hono, Handler, Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { upgradeWebSocket } from "hono/deno";
import { EndpointContract, Method } from "../contract.ts";
import { JSONSchema } from "../schema.ts";
import * as AJV from "ajv";
import { InvalidResponseError, SubrouteNotFoundError } from "./errors.ts";

/**
 * Parse URL query params, attempting JSON.parse on each value
 */
function parseQueryParams(context: Context): Record<string, unknown> {
  const query = context.req.query();
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(query)) {
    try {
      result[key] = JSON.parse(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}

class BuildPhase<T> implements PromiseLike<T> {
  #run: (phase: BuildPhase<T>) => Promise<void> | void;
  // deno-lint-ignore no-explicit-any
  #dependencies: BuildPhase<any>[] = [];
  #promise: Promise<T>;
  complete!: (value: T | PromiseLike<T>) => void;
  fail!: (reason?: unknown) => void;

  constructor(job: (phase: BuildPhase<T>) => Promise<void> | void) {
    this.#promise = new Promise<T>((resolve, reject) => {
      this.complete = resolve;
      this.fail = reject;
    });
    this.#run = job;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected);
  }

  #inprogress?: Promise<void>;
  run(): this {
    if (!this.#inprogress) {
      this.#inprogress = Promise.all(
        this.#dependencies.map((dep) => dep.run())
      ).then(() => this.#run(this)).catch((err) => this.fail(err));
    }
    return this;
  }

  // deno-lint-ignore no-explicit-any
  depends(...phases: BuildPhase<any>[]): this {
    this.#dependencies.push(...phases);
    return this;
  }
}

type HandlerMap = {
  [K in Method]?: Handler[];
}

class RouteBuilder extends Map<string, RouteBuilder> {
  static async build(
    contracts: EndpointContract<JSONSchema, JSONSchema, JSONSchema>[],
    base?: string
  ): Promise<Hono> {
    const root = new RouteBuilder("", base);
    for (const contract of contracts)
      root
        .ensure(contract.path)
        .contracts.push(contract);

    return (await root.build().run()).router!;
  }
  static segment(path: string): string[] {
    return path.split("/").filter(Boolean);
  }
  static compose(...segments: string[]): string {
    return segments.filter(Boolean).join("/");
  }
  static #ajv = new AJV.Ajv();
  static compile = RouteBuilder.#ajv.compile.bind(RouteBuilder.#ajv);

  readonly #segments: string[];

  constructor(
    path: string = "",
    readonly base?: string
  ) {
    super();
    this.path = path;
    this.#segments = RouteBuilder.segment(path);
    this.segment = this.#segments.at(-1) ?? "";
  }

  readonly path: string;
  readonly segment: string;

  enforce(segments: string[]): RouteBuilder {
    if (segments.length === 0)
      return this;

    const [head, ...tail] = segments;
    let child = this.get(head);
    if (!child) {
      child = new RouteBuilder(
        RouteBuilder.compose(this.path, head),
        this.base
      );
      this.set(head, child);
    }
    return child.enforce(tail);
  }
  ensure(path: string): RouteBuilder {
    return this.enforce(RouteBuilder.segment(path))
  }

  // build helpers
  #phase<T>(job: (phase: BuildPhase<T>) => Promise<void> | void): BuildPhase<T> {
    return new BuildPhase<T>(job);
  }
  #instant<T>(value: T): BuildPhase<T> {
    return this.#phase((phase) => {
      phase.complete(value);
    });
  }
  #compile = RouteBuilder.compile;

  /**
   * Parse request input: try JSON body first, fall back to URL params
   * URL params are always available via context.req.query() for usercode
   */
  async #parseInput(context: Context): Promise<unknown> {
    // Try to parse JSON body first (if request has a body)
    const contentLength = context.req.header("content-length");
    const contentType = context.req.header("content-type");

    if (contentLength && contentLength !== "0") {
      try {
        const text = await context.req.text();
        if (text && text.trim()) {
          return JSON.parse(text);
        }
      } catch {
        // Invalid JSON body, fall through to query params
      }
    } else if (contentType?.includes("application/json")) {
      // Content-Type set but no content-length, still try to read
      try {
        const text = await context.req.text();
        if (text && text.trim()) {
          return JSON.parse(text);
        }
      } catch {
        // No valid JSON body, fall through to query params
      }
    }

    // Fall back to URL query params
    return parseQueryParams(context);
  }

  // build steps
  #_init?: BuildPhase<Hono>;
  #init(): BuildPhase<Hono> {
    return this.#_init ??= this.#instant(new Hono());
  }
  #_handlers?: BuildPhase<HandlerMap>;
  #handlers(): BuildPhase<HandlerMap> {
    return this.#_handlers ??= this.#phase<HandlerMap>((phase) => {
      const handlers: HandlerMap = {};
      for (const contract of this.contracts) {
        const method = contract.method;
        if (!handlers[method])
          handlers[method] = [];

        // Prepend WebSocket middleware for contracts with websocket: true
        if (contract.websocket) {
          const base = this.base;
          const wsHandler = upgradeWebSocket(async (c) => {
            const modulePath = base
              ? new URL(contract.module, base).href
              : contract.module;
            const handler = await import(modulePath);
            return handler.ws(c);
          });
          handlers[method]!.push(wsHandler);
        }

        const assert = {
          request: contract.request
            ? this.#compile(contract.request)
            : undefined,
          error: contract.error
            ? this.#compile(contract.error)
            : undefined,
          response: this.#compile(contract.response),
        }
        handlers[method]!.push(async (context, next) => {
          // HEAD contracts are registered on GET (Hono routes HEAD through GET).
          // Ensure HEAD handlers only respond to actual HEAD requests.
          if (method === "HEAD" && context.req.method !== "HEAD") {
            return await next();
          }

          try {
            let input: unknown;
            if (assert.request) {
              // Try JSON body first (for all methods), fall back to URL params
              input = await this.#parseInput(context);

              if (!assert.request(input))
                return await next();
            }
            const modulePath = this.base
              ? new URL(contract.module, this.base).href
              : contract.module;
            const handler = await import(modulePath)
            const output = await handler.default(input, context)
            if (!assert.response(output))
              throw new InvalidResponseError(output);
            return context.json(output); // Hono gracefully handles HEAD response writes. We don't need to do anything special here.
          } catch (err) {
            if (assert.error && assert.error(err)) {
              const status = (err as { status?: number }).status ?? 500;
              return context.json(err, status as ContentfulStatusCode);
            } else {
              throw err;
            }
          }
        })
      }
      phase.complete(handlers);
    });
  }
  #_setup?: BuildPhase<void>;
  #setup(): BuildPhase<void> {
    if (this.#_setup)
      return this.#_setup;

    const init = this.#init();
    const handlers = this.#handlers();

    return this.#_setup = this
      .#phase<void>(async (phase) => {
        const endpoint = await init;
        const handler_map = await handlers;

        for (const [
          method, method_handlers
        ] of Object.entries(handler_map)) {
          // Hono routes HEAD requests through GET handlers, so HEAD contracts
          // must be registered on GET. The handler can check c.req.method if needed.
          const registrationMethod = method === "HEAD" ? "GET" : method;
          endpoint.on(registrationMethod, '/', ...method_handlers, () => {
            throw new SubrouteNotFoundError(this.path);
          });
        }
        endpoint.onError((err, c) => {
          if (err instanceof SubrouteNotFoundError)
            return c.json({ message: err.message }, err.status);
          if (err instanceof InvalidResponseError)
            return c.json({ message: "Invalid response from server", cause: err.cause }, err.status);
          return c.json({ message: "Internal server error", cause: String(err) }, 500);
        });
        phase.complete();
      })
      .depends(init, handlers);
  }
  #_children?: BuildPhase<void>;
  #children(): BuildPhase<void> {
    if (this.#_children)
      return this.#_children;

    const children = Array.from(this.values()).map(
      (child) => child.build()
    );
    const init = this.#init();

    return this.#_children = this.#phase<void>(async (phase) => {
      const endpoint = await init;
      for await (const child of children) {
        endpoint.route(
          `/${child.segment}`,
          child.router!
        )
      }
      phase.complete();
    }).depends(...children, init);
  }
  #_final?: BuildPhase<this>;
  build(): BuildPhase<this> {
    if (this.#_final)
      return this.#_final;

    const setup = this.#setup();
    const children = this.#children();
    const init = this.#init();

    return this.#_final = this.#phase<this>(async (phase) => {
      this.router = await init;
      phase.complete(this);
    }).depends(setup, children, init);
  }

  router?: Hono;
  contracts: EndpointContract<JSONSchema, JSONSchema, JSONSchema>[] = [];
}

export const build = RouteBuilder.build;