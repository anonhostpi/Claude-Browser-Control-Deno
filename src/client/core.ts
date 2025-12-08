import * as API from "../orchestrator/contracts/api.ts";

type TailParameters<Func> =
  // deno-lint-ignore no-explicit-any
  Func extends (first: any, ...args: infer P) => any ? P : never;

export type IRootCLI = API.Root.Binding;
export const root = API.Root.miniclient();
export type RootBinding = API.Root.MiniBinding;
export type RootExtensions = typeof root;
type VerifyRootExtensions =
  API.Root.AssertMiniBinding<RootExtensions>;
export type IRootClient = Omit<{
  [K in keyof RootExtensions]:
    (...args: TailParameters<RootExtensions[K]>) =>
      ReturnType<RootExtensions[K]>;
}, "health"> & {
  health(): Promise<boolean>;
  endpoint(name: string): Promise<IEndpointClient>;
};
type VerifyIRootClient =
  API.Root.AssertMiniBinding<IRootClient>;

export type IEndpointCLI = API.Endpoint.Binding;
export const endpoint = API.Endpoint.miniclient();
export type EndpointExtensions = typeof endpoint;
type VerifyEndpointExtensions =
  API.Endpoint.AssertMiniBinding<EndpointExtensions>;
export type IEndpointClient = Omit<{
  [K in keyof EndpointExtensions]:
    (...args: TailParameters<EndpointExtensions[K]>) =>
      ReturnType<EndpointExtensions[K]>;
}, "exists"> & {
  exists(): Promise<boolean>;
  context(id: string): Promise<IContextClient>;
}

type VerifyIEndpointClient =
  API.Endpoint.AssertMiniBinding<IEndpointClient>;

export type IContextCLI = API.Context.Binding;
export const context = API.Context.miniclient();
export type ContextExtensions = typeof context;
type VerifyContextExtensions =
  API.Context.AssertMiniBinding<ContextExtensions>;
export type IContextClient = Omit<{
  [K in keyof ContextExtensions]:
    (...args: TailParameters<ContextExtensions[K]>) =>
      ReturnType<ContextExtensions[K]>;
}, "exists" | "create" > & {
  exists(): Promise<boolean>;
  create(options?: API.Context.CreateRequest): Promise<boolean>;
  target(id: string): Promise<ITargetClient>;
}
type VerifyIContextClient =
  API.Context.AssertMiniBinding<IContextClient>;

export type ITargetCLI = API.Target.Binding;
export const target = API.Target.miniclient();
export type TargetExtensions = typeof target;
type VerifyTargetExtensions =
  API.Target.AssertMiniBinding<TargetExtensions>;
export type ITargetClient = Omit<{
  [K in keyof TargetExtensions]:
    (...args: TailParameters<TargetExtensions[K]>) =>
      ReturnType<TargetExtensions[K]>;
}, "exists"> & {
  exists(): Promise<boolean>;
  node(id: number): Promise<INodeClient>;
}
type VerifyITargetClient =
  API.Target.AssertMiniBinding<ITargetClient>;

export type INodeCLI = API.Node.Binding;
export const node = API.Node.miniclient();
export type NodeExtensions = typeof node;
type VerifyNodeExtensions =
  API.Node.AssertMiniBinding<NodeExtensions>;
export type INodeClient = Omit<{
  [K in keyof NodeExtensions]:
    (...args: TailParameters<NodeExtensions[K]>) =>
      ReturnType<NodeExtensions[K]>;
}, "exists" | "create"> & {
  exists(): Promise<boolean>;
  create(options: API.Node.CreateRequest): Promise<INodeClient>;
};
type VerifyINodeClient =
  API.Node.AssertMiniBinding<INodeClient>;

// deno-lint-ignore no-namespace
export namespace Helpers {
  export type MainKey<T> = Extract<keyof T, `${string}:${string}`> extends never
    ? keyof T
    : Exclude<keyof T, `${string}:${string}`>;
  export type DisallowOverlap<A, B> =
    Exclude<A, B> extends A
      ? (Exclude<B, A> extends B ? A | B : never)
      : never;
  export type FirstChars<T extends string> =
    T extends `${infer C}${string}` ? C : never;
}

export type PathParam =
  Helpers.MainKey<
    & API.Root.FullBinding
    & API.Endpoint.FullBinding
    & API.Context.FullBinding
    & API.Target.FullBinding
    & API.Node.FullBinding
  >;

/**
 * Path parameters type (excludes "root" since root has no path params)
 * Derived from contract bindings for type safety.
 */
export type PathParams = {
  [K in Exclude<PathParam, "root">]?: string;
};

/**
 * Client level type - same as PathParam.
 * Represents the hierarchy levels: root, endpoint, context, target, node.
 */
export type ClientLevel = PathParam;

export type AllExtensions =
  & RootExtensions
  & EndpointExtensions
  & ContextExtensions
  & TargetExtensions
  & NodeExtensions;

export type IFullCLI =
  & IRootCLI
  & IEndpointCLI
  & IContextCLI
  & ITargetCLI
  & INodeCLI;

type ICombinedClient =
  & IRootClient
  & IEndpointClient
  & IContextClient
  & ITargetClient
  & INodeClient;

export type AllContractOptions =
  Helpers.FirstChars<Exclude<PathParam, "root">> | keyof ICombinedClient;

